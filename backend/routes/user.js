const crypto = require('crypto');
const express = require('express');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const OnboardingSession = require('../models/OnboardingSession');
const OnboardingSurveyResponse = require('../models/OnboardingSurveyResponse');
const { ONBOARDING_EVENT_NAMES } = require('../models/OnboardingSession');
const Expo = require('expo-server-sdk').Expo;
const expoPush = new Expo();

const router = express.Router();
const BUCKET = process.env.S3_BUCKET_NAME || 'ldr-uploads';
const REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? new S3Client({
        region: REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      })
    : null;

function sanitizeOptionalName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function splitFullName(fullName) {
  const trimmed = sanitizeOptionalName(fullName);
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function getUserNameFields(user) {
  const firstName = sanitizeOptionalName(user.firstName);
  const lastName = sanitizeOptionalName(user.lastName);
  if (firstName || lastName) {
    return {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
    };
  }
  const parsed = splitFullName(user.name);
  return {
    firstName: parsed.firstName || undefined,
    lastName: parsed.lastName || undefined,
    name: sanitizeOptionalName(user.name) || undefined,
  };
}

const MAX_BATCH_EVENTS = 120;
const MAX_METADATA_JSON_LENGTH = 2000;

function asTrimmedString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parseOccurredAt(value) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function sanitizeMetadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  try {
    const json = JSON.stringify(input);
    if (!json || json.length > MAX_METADATA_JSON_LENGTH) return {};
    return JSON.parse(json);
  } catch (err) {
    return {};
  }
}

function normalizeEvent(rawEvent) {
  const eventId = asTrimmedString(rawEvent?.eventId);
  const eventName = asTrimmedString(rawEvent?.eventName);
  const sessionId = asTrimmedString(rawEvent?.sessionId);
  if (!eventId || !sessionId || !ONBOARDING_EVENT_NAMES.includes(eventName)) {
    return null;
  }

  const parsedSlideIndex = Number(rawEvent?.slideIndex);
  const slideIndex = Number.isInteger(parsedSlideIndex) ? parsedSlideIndex : null;
  const parsedTimeOnSlide = Number(rawEvent?.timeOnSlideMs);
  const timeOnSlideMs =
    Number.isFinite(parsedTimeOnSlide) && parsedTimeOnSlide >= 0
      ? Math.round(parsedTimeOnSlide)
      : null;

  return {
    eventId,
    sessionId,
    eventName,
    slideIndex,
    slideKey: asTrimmedString(rawEvent?.slideKey) || null,
    timeOnSlideMs,
    occurredAt: parseOccurredAt(rawEvent?.occurredAt),
    metadata: sanitizeMetadata(rawEvent?.metadata),
  };
}

function normalizeArrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asTrimmedString(item))
    .filter(Boolean)
    .slice(0, 12);
}

function buildDocsFromBatch(rawEvents, userId) {
  if (!Array.isArray(rawEvents)) return [];
  const docs = [];
  for (const rawEvent of rawEvents.slice(0, MAX_BATCH_EVENTS)) {
    const normalized = normalizeEvent(rawEvent);
    if (!normalized) continue;
    docs.push({
      ...normalized,
      userId: userId || null,
    });
  }
  return docs;
}

function parseDateQuery(value) {
  const parsed = value ? new Date(String(value)) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function upsertOnboardingSessionAndSurvey(docs, userId) {
  if (!docs.length) return { accepted: 0, sessionId: null };
  const sessionId = docs[0].sessionId;
  const sorted = [...docs].sort((a, b) => a.occurredAt - b.occurredAt);
  const startedAt =
    sorted.find((d) => d.eventName === 'onboarding_started')?.occurredAt || sorted[0].occurredAt;
  const completedAt = sorted.find((d) => d.eventName === 'onboarding_completed')?.occurredAt || null;
  const exitedAt = sorted.find((d) => d.eventName === 'onboarding_exited')?.occurredAt || null;
  const appVersion =
    asTrimmedString(sorted[sorted.length - 1]?.metadata?.appVersion) || null;
  const lastSlideDoc = [...sorted]
    .reverse()
    .find((d) => Number.isInteger(d.slideIndex) && d.eventName === 'slide_viewed');
  const latestExitDoc = [...sorted]
    .reverse()
    .find((d) => d.eventName === 'onboarding_exited');

  const session = await OnboardingSession.findOne({ sessionId }).lean();
  const existingIds = new Set((session?.timeline || []).map((event) => event.eventId));
  const newTimeline = sorted.filter((event) => !existingIds.has(event.eventId));

  const updateDoc = {
    $setOnInsert: {
      sessionId,
      startedAt,
      subscriptionConverted: false,
    },
    $set: {
      appVersion,
    },
  };
  if (userId) {
    updateDoc.$set.userId = userId;
  }
  if (completedAt) {
    updateDoc.$set.completedAt = completedAt;
    updateDoc.$set.exitedAt = null;
    updateDoc.$set.exitedSlideTitle = null;
  } else if (exitedAt && !session?.completedAt) {
    updateDoc.$set.exitedAt = exitedAt;
  }
  if (lastSlideDoc) {
    updateDoc.$set.lastSlideIndex = lastSlideDoc.slideIndex;
    updateDoc.$set.lastSlideTitle = asTrimmedString(lastSlideDoc?.metadata?.slideTitle) || null;
  }
  if (latestExitDoc) {
    updateDoc.$set.exitedSlideTitle = asTrimmedString(latestExitDoc?.metadata?.slideTitle) || null;
  }
  if (newTimeline.length) {
    updateDoc.$push = {
      timeline: {
        $each: newTimeline,
        $slice: -300,
      },
    };
  }

  await OnboardingSession.updateOne({ sessionId }, updateDoc, { upsert: true });

  const surveyWrites = [];
  for (const event of sorted) {
    const questionKey = asTrimmedString(event?.metadata?.questionKey);
    if (!questionKey) continue;
    const selectedOptions = normalizeArrayOfStrings(event?.metadata?.selectedOptions);
    const partnerNameInput = asTrimmedString(event?.metadata?.partnerNameInput) || null;
    surveyWrites.push(
      OnboardingSurveyResponse.updateOne(
        { sessionId, questionKey },
        {
          $set: {
            userId: userId || null,
            selectedOptions,
            partnerNameInput,
            answeredAt: event.occurredAt,
            appVersion: asTrimmedString(event?.metadata?.appVersion) || null,
          },
        },
        { upsert: true }
      )
    );
  }
  await Promise.all(surveyWrites);
  return { accepted: newTimeline.length, sessionId };
}

async function updateOnboardingSubscription({
  sessionId,
  userId,
  didSubscribe,
  paymentOption,
  subscriptionSource,
  paywallResult,
}) {
  if (!sessionId && !userId) return;
  const setDoc = {
    subscriptionCheckedAt: new Date(),
  };
  if (typeof didSubscribe === 'boolean') setDoc.subscriptionConverted = didSubscribe;
  if (paymentOption) setDoc.paymentOption = paymentOption;
  if (subscriptionSource) setDoc.subscriptionSource = subscriptionSource;
  if (paywallResult) setDoc.paywallResult = paywallResult;
  if (userId) setDoc.userId = userId;

  const filter = sessionId ? { sessionId } : { userId };
  await OnboardingSession.findOneAndUpdate(
    filter,
    {
      $set: setDoc,
      $setOnInsert: {
        sessionId: sessionId || `derived_${Date.now()}_${String(userId)}`,
        startedAt: new Date(),
      },
    },
    { upsert: true, sort: { createdAt: -1 } }
  );
}

/** POST /api/user/onboarding-events/anonymous — ingest anonymous onboarding events. */
router.post('/onboarding-events/anonymous', async (req, res) => {
  try {
    const docs = buildDocsFromBatch(req.body?.events, null);
    if (!docs.length) {
      return res.status(400).json({ error: 'events payload must contain at least one valid event' });
    }
    const result = await upsertOnboardingSessionAndSurvey(docs, null);
    return res.json({ ok: true, accepted: result.accepted, sessionId: result.sessionId });
  } catch (err) {
    console.error('[onboarding-events/anonymous]', err?.message || err);
    return res.status(500).json({ error: 'Could not ingest onboarding events' });
  }
});

/** POST /api/user/onboarding-events — ingest authenticated onboarding events. */
router.post('/onboarding-events', requireAuth, async (req, res) => {
  try {
    const docs = buildDocsFromBatch(req.body?.events, req.user._id);
    if (!docs.length) {
      return res.status(400).json({ error: 'events payload must contain at least one valid event' });
    }
    const result = await upsertOnboardingSessionAndSurvey(docs, req.user._id);
    return res.json({ ok: true, accepted: result.accepted, sessionId: result.sessionId });
  } catch (err) {
    console.error('[onboarding-events/authenticated]', err?.message || err);
    return res.status(500).json({ error: 'Could not ingest onboarding events' });
  }
});

/** POST /api/user/onboarding-events/stitch — attach authenticated user to prior session events. */
router.post('/onboarding-events/stitch', requireAuth, async (req, res) => {
  try {
    const sessionId = asTrimmedString(req.body?.sessionId);
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const sessionUpdate = await OnboardingSession.updateMany(
      { sessionId, userId: null },
      { $set: { userId: req.user._id } }
    );
    const surveyUpdate = await OnboardingSurveyResponse.updateMany(
      { sessionId, userId: null },
      { $set: { userId: req.user._id } }
    );

    return res.json({
      ok: true,
      matched: (sessionUpdate.matchedCount ?? 0) + (surveyUpdate.matchedCount ?? 0),
      stitched: (sessionUpdate.modifiedCount ?? 0) + (surveyUpdate.modifiedCount ?? 0),
    });
  } catch (err) {
    console.error('[onboarding-events/stitch]', err?.message || err);
    return res.status(500).json({ error: 'Could not stitch onboarding events' });
  }
});

/** POST /api/user/onboarding-subscription — store conversion + payment option for onboarding session. */
router.post('/onboarding-subscription', requireAuth, async (req, res) => {
  try {
    const sessionId = asTrimmedString(req.body?.sessionId);
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    await updateOnboardingSubscription({
      sessionId,
      userId: req.user._id,
      didSubscribe: typeof req.body?.didSubscribe === 'boolean' ? req.body.didSubscribe : undefined,
      paymentOption: asTrimmedString(req.body?.paymentOption) || null,
      subscriptionSource: asTrimmedString(req.body?.subscriptionSource) || null,
      paywallResult: asTrimmedString(req.body?.paywallResult) || null,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[onboarding-subscription]', err?.message || err);
    return res.status(500).json({ error: 'Could not store onboarding subscription data' });
  }
});

/** GET /api/user/onboarding-insights — funnel metrics for onboarding. */
router.get('/onboarding-insights', requireAuth, async (req, res) => {
  try {
    const from = parseDateQuery(req.query.from);
    const to = parseDateQuery(req.query.to);
    const appVersion = asTrimmedString(req.query.appVersion);
    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = from;
      if (to) match.createdAt.$lte = to;
    }
    if (appVersion) {
      match.appVersion = appVersion;
    }

    const [viewsRaw, advancesRaw, backsRaw, timeRaw, sessionsRaw, surveyRaw] = await Promise.all([
      OnboardingSession.aggregate([
        { $match: match },
        { $unwind: '$timeline' },
        { $match: { 'timeline.eventName': 'slide_viewed' } },
        { $group: { _id: '$timeline.slideIndex', views: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      OnboardingSession.aggregate([
        { $match: match },
        { $unwind: '$timeline' },
        { $match: { 'timeline.eventName': 'slide_advanced' } },
        { $group: { _id: '$timeline.slideIndex', advances: { $sum: 1 } } },
      ]),
      OnboardingSession.aggregate([
        { $match: match },
        { $unwind: '$timeline' },
        { $match: { 'timeline.eventName': 'slide_back' } },
        { $group: { _id: '$timeline.slideIndex', backs: { $sum: 1 } } },
      ]),
      OnboardingSession.aggregate([
        { $match: match },
        { $unwind: '$timeline' },
        {
          $match: {
            'timeline.eventName': { $in: ['slide_advanced', 'slide_back', 'onboarding_exited', 'onboarding_completed'] },
            'timeline.timeOnSlideMs': { $type: 'number' },
          },
        },
        {
          $group: {
            _id: '$timeline.slideIndex',
            avgTimeOnSlideMs: { $avg: '$timeline.timeOnSlideMs' },
            medianSamples: { $push: '$timeline.timeOnSlideMs' },
          },
        },
      ]),
      OnboardingSession.find(match)
        .select('sessionId completedAt lastSlideIndex subscriptionConverted paymentOption')
        .lean(),
      OnboardingSurveyResponse.aggregate([
        {
          $match: {
            ...(appVersion ? { appVersion } : {}),
            ...(from || to
              ? {
                  answeredAt: {
                    ...(from ? { $gte: from } : {}),
                    ...(to ? { $lte: to } : {}),
                  },
                }
              : {}),
          },
        },
        { $unwind: { path: '$selectedOptions', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              questionKey: '$questionKey',
              option: '$selectedOptions',
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const advanceBySlide = new Map(advancesRaw.map((row) => [row._id, row.advances]));
    const backBySlide = new Map(backsRaw.map((row) => [row._id, row.backs]));
    const timeBySlide = new Map(
      timeRaw.map((row) => {
        const sorted = [...(row.medianSamples || [])].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        const median =
          sorted.length === 0
            ? null
            : sorted.length % 2 === 0
              ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
              : sorted[middle];
        return [
          row._id,
          {
            avgTimeOnSlideMs: Math.round(asNumber(row.avgTimeOnSlideMs)),
            medianTimeOnSlideMs: median,
          },
        ];
      })
    );

    const dropOffBySlide = new Map();
    let startedSessions = 0;
    let completedSessions = 0;
    let subscribedSessions = 0;
    const paymentOptionCounts = {};
    for (const session of sessionsRaw) {
      startedSessions += 1;
      if (session.completedAt) completedSessions += 1;
      if (session.subscriptionConverted === true) subscribedSessions += 1;
      if (session.paymentOption) {
        paymentOptionCounts[session.paymentOption] = (paymentOptionCounts[session.paymentOption] || 0) + 1;
      }
      if (!session.completedAt && Number.isInteger(session.lastSlideIndex) && session.lastSlideIndex >= 0) {
        dropOffBySlide.set(
          session.lastSlideIndex,
          (dropOffBySlide.get(session.lastSlideIndex) || 0) + 1
        );
      }
    }

    const perSlide = viewsRaw.map((row) => {
      const slideIndex = row._id;
      const views = row.views;
      const advances = advanceBySlide.get(slideIndex) || 0;
      const backs = backBySlide.get(slideIndex) || 0;
      const dropOffs = dropOffBySlide.get(slideIndex) || 0;
      const time = timeBySlide.get(slideIndex) || {};
      return {
        slideIndex,
        views,
        advances,
        backs,
        dropOffs,
        advanceRate: views > 0 ? Number((advances / views).toFixed(4)) : 0,
        backRate: views > 0 ? Number((backs / views).toFixed(4)) : 0,
        dropOffRate: views > 0 ? Number((dropOffs / views).toFixed(4)) : 0,
        avgTimeOnSlideMs: time.avgTimeOnSlideMs ?? null,
        medianTimeOnSlideMs: time.medianTimeOnSlideMs ?? null,
      };
    });

    const surveyByQuestion = {};
    for (const row of surveyRaw) {
      const questionKey = row?._id?.questionKey;
      const option = row?._id?.option;
      if (!questionKey || !option) continue;
      if (!surveyByQuestion[questionKey]) surveyByQuestion[questionKey] = [];
      surveyByQuestion[questionKey].push({
        option,
        count: row.count || 0,
      });
    }

    return res.json({
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
      appVersion: appVersion || null,
      funnel: {
        startedSessions,
        completedSessions,
        completionRate: startedSessions > 0 ? Number((completedSessions / startedSessions).toFixed(4)) : 0,
        subscribedSessions,
        subscriptionConversionRate:
          startedSessions > 0 ? Number((subscribedSessions / startedSessions).toFixed(4)) : 0,
      },
      perSlide,
      survey: surveyByQuestion,
      paymentOptions: paymentOptionCounts,
    });
  } catch (err) {
    console.error('[onboarding-insights]', err?.message || err);
    return res.status(500).json({ error: 'Could not compute onboarding insights' });
  }
});

/** GET /api/user/partner — fetch current user's partner profile (safe fields only). */
router.get('/partner', requireAuth, async (req, res) => {
  try {
    const partnerId = req.user.partnerId;
    if (!partnerId) {
      return res.status(404).json({ error: 'No partner linked' });
    }
    const partner = await User.findById(partnerId)
      .select('name firstName lastName email location batteryLevel lastUpdatedDataAt reunion photos timezone mood')
      .lean();
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    const coords = partner.location?.coords?.coordinates;
    const location =
      partner.location && coords && coords.length >= 2
        ? {
            city: partner.location.city || undefined,
            lat: coords[1],
            lng: coords[0],
          }
        : undefined;
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const partnerPhotos = (partner.photos || [])
      .filter((p) => new Date(p.createdAt) >= cutoff24h)
      .map((p) => ({
        url: p.url,
        thumbnailUrl: p.thumbnailUrl || undefined,
        createdAt: new Date(p.createdAt).toISOString(),
        caption: p.caption || '',
      }));
    res.json({
      partner: {
        id: partner._id,
        ...getUserNameFields(partner),
        email: partner.email || undefined,
        location,
        batteryLevel:
          partner.batteryLevel != null ? partner.batteryLevel / 100 : null,
        lastUpdatedDataAt: partner.lastUpdatedDataAt
          ? partner.lastUpdatedDataAt.toISOString()
          : null,
        reunion:
          partner.reunion?.startDate != null
            ? {
                startDate: new Date(partner.reunion.startDate).toISOString(),
                endDate: partner.reunion.endDate
                  ? new Date(partner.reunion.endDate).toISOString()
                  : null,
              }
            : null,
        photos: partnerPhotos,
        timezone: partner.timezone || undefined,
        mood:
          partner.mood?.emoji != null || partner.mood?.text != null
            ? {
                emoji: partner.mood.emoji || undefined,
                text: partner.mood.text || undefined,
              }
            : undefined,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/user/photo — add a photo URL to the user's Daily Story (after S3 upload). Generates widget thumbnail and uploads to S3. */
router.post('/photo', requireAuth, async (req, res) => {
  try {
    const { url, caption } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'url is required' });
    }
    const captionStr =
      typeof caption === 'string' && caption.trim()
        ? caption.trim().slice(0, 60)
        : '';
    const photoUrl = url.trim();
    req.user.photos = req.user.photos || [];
    req.user.photos.push({ url: photoUrl, createdAt: new Date(), caption: captionStr });
    let thumbnailUrl = null;
    if (s3Client) {
      try {
        const imageRes = await fetch(photoUrl);
        if (imageRes.ok) {
          const buffer = Buffer.from(await imageRes.arrayBuffer());
          const thumbBuffer = await sharp(buffer)
            .resize(500, 500, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();
          const thumbKey = `photos/${req.user._id}/${Date.now()}-${crypto.randomUUID()}_thumb.jpg`;
          await s3Client.send(
            new PutObjectCommand({
              Bucket: BUCKET,
              Key: thumbKey,
              Body: thumbBuffer,
              ContentType: 'image/jpeg',
            })
          );
          thumbnailUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${thumbKey}`;
          req.user.photos[req.user.photos.length - 1].thumbnailUrl = thumbnailUrl;
        }
      } catch (thumbErr) {
        // HEIF/HEIC from iOS not supported by sharp by default; use full-size URL so photo still shows
        console.warn('[photo thumbnail]', thumbErr?.message || thumbErr, '— using original URL');
        thumbnailUrl = photoUrl;
        req.user.photos[req.user.photos.length - 1].thumbnailUrl = thumbnailUrl;
      }
    }
    await req.user.save();

    // Notify partner so widget can update in background (Locket-style) and show visible notification
    const finalPhotoUrl = thumbnailUrl || photoUrl;
    const partnerId = req.user.partnerId;
    if (finalPhotoUrl && partnerId && Expo.isExpoPushToken) {
      try {
        const partner = await User.findById(partnerId).select('pushToken').lean();
        const pushToken = partner?.pushToken;
        if (pushToken && Expo.isExpoPushToken(pushToken)) {
          const senderName = getUserNameFields(req.user).firstName || 'Your partner';
          const messages = [
            {
              to: pushToken,
              title: `${senderName} sent a picture`,
              body: captionStr || 'Tap to view',
              sound: 'default',
              data: {
                photoUrl: finalPhotoUrl,
                caption: captionStr,
                type: 'new_photo',
              },
              mutableContent: true,
              _mutableContent: true,
              contentAvailable: true,
              _contentAvailable: true,
            },
          ];
          await expoPush.sendPushNotificationsAsync(messages);
        }
      } catch (pushErr) {
        console.error('[photo push]', pushErr?.message || pushErr);
      }
    }

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const photos = (req.user.photos || [])
      .filter((p) => new Date(p.createdAt) >= cutoff24h)
      .map((p) => ({
        url: p.url,
        thumbnailUrl: p.thumbnailUrl || undefined,
        createdAt: p.createdAt.toISOString(),
        caption: p.caption || '',
      }));
    res.json({ photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/user/battery — update current user's battery level (0–1). Sets lastUpdatedDataAt. */
router.put('/battery', requireAuth, async (req, res) => {
  try {
    const { batteryLevel } = req.body;
    if (typeof batteryLevel !== 'number' || Number.isNaN(batteryLevel)) {
      return res.status(400).json({ error: 'batteryLevel must be a number' });
    }
    const value = Math.max(0, Math.min(1, batteryLevel));
    req.user.batteryLevel = Math.round(value * 100);
    req.user.lastUpdatedDataAt = new Date();
    await req.user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/user/location — update current user's location (city + coords). */
router.put('/location', requireAuth, async (req, res) => {
  try {
    const { city, lat, lng } = req.body;
    const hasCoords =
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !Number.isNaN(lat) &&
      !Number.isNaN(lng);
    if (!hasCoords) {
      return res.status(400).json({ error: 'lat and lng are required numbers' });
    }
    req.user.location = req.user.location || {};
    req.user.location.city = typeof city === 'string' ? city.trim() || null : null;
    req.user.location.coords = {
      type: 'Point',
      coordinates: [lng, lat],
    };
    await req.user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/user/settings — update current user settings (e.g. timezone). */
router.put('/settings', requireAuth, async (req, res) => {
  try {
    const { timezone } = req.body;
    if (typeof timezone !== 'string' || !timezone.trim()) {
      return res.status(400).json({ error: 'timezone must be a non-empty string' });
    }
    req.user.timezone = timezone.trim();
    await req.user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/user/mood — update current user mood (emoji + optional text). Notifies partner via push. */
router.put('/mood', requireAuth, async (req, res) => {
  try {
    const { emoji, text } = req.body;
    req.user.mood = req.user.mood || {};
    req.user.mood.emoji = typeof emoji === 'string' && emoji.trim() ? emoji.trim() : null;
    req.user.mood.text = typeof text === 'string' && text.trim() ? text.trim().slice(0, 15) : null;
    await req.user.save();

    // Notify partner that mood was updated
    const partnerId = req.user.partnerId;
    if (partnerId && Expo.isExpoPushToken) {
      try {
        const partner = await User.findById(partnerId).select('pushToken').lean();
        const pushToken = partner?.pushToken;
        if (pushToken && Expo.isExpoPushToken(pushToken)) {
          const senderName = getUserNameFields(req.user).firstName || 'Your partner';
          const moodEmoji = req.user.mood?.emoji || '';
          const moodText = req.user.mood?.text || '';
          const body = [moodEmoji, moodText].filter(Boolean).join(' ') || 'Tap to see';
          const messages = [
            {
              to: pushToken,
              title: `${senderName} updated their mood`,
              body,
              sound: 'default',
              data: { type: 'mood_update' },
            },
          ];
          await expoPush.sendPushNotificationsAsync(messages);
        }
      } catch (pushErr) {
        console.error('[mood push]', pushErr?.message || pushErr);
      }
    }

    res.json({
      mood: {
        emoji: req.user.mood.emoji || undefined,
        text: req.user.mood.text || undefined,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/user/push-token — save Expo push token for the authenticated user (used to send new-photo pushes to partner). */
router.put('/push-token', requireAuth, async (req, res) => {
  try {
    const pushToken = req.body.pushToken != null ? String(req.body.pushToken).trim() || null : null;
    req.user.pushToken = pushToken;
    await req.user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/user/sync-subscription — sync isPremium from RevenueCat (used when webhook missed). Verifies entitlement server-side; does not trust client. */
router.post('/sync-subscription', requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.REVENUECAT_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Subscription sync not configured' });
    }
    const appUserId = String(req.user._id);
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      }
    );
    if (!response.ok) {
      const text = await response.text();
      console.error('[sync-subscription] RevenueCat API error', response.status, text);
      return res.status(502).json({ error: 'Could not verify subscription' });
    }
    const data = await response.json();
    const entitlements = data?.subscriber?.entitlements ?? {};
    const now = new Date();
    const hasPremium = Object.values(entitlements).some((e) => {
      const exp = e?.expires_date ?? e?.expiration_date;
      return exp && new Date(exp) > now;
    });
    await User.findByIdAndUpdate(req.user._id, { isPremium: !!hasPremium });
    if (hasPremium && req.user.partnerId) {
      await User.findByIdAndUpdate(req.user.partnerId, { isPremium: true });
    }
    req.user.isPremium = !!hasPremium;
    const sessionId = asTrimmedString(req.body?.sessionId);
    const paymentOption =
      asTrimmedString(req.body?.paymentOption) ||
      asTrimmedString(
        Object.values(entitlements || {}).find((e) => e && e.product_identifier)?.product_identifier
      ) ||
      null;
    const paywallResult = asTrimmedString(req.body?.paywallResult) || null;
    const subscriptionSource = asTrimmedString(req.body?.subscriptionSource) || 'paywall';
    await updateOnboardingSubscription({
      sessionId,
      userId: req.user._id,
      didSubscribe: !!hasPremium,
      paymentOption,
      subscriptionSource,
      paywallResult,
    });
    res.json({ ok: true, isPremium: req.user.isPremium, paymentOption });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const NAME_CHANGE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/** PUT /api/user/profile — update current user profile (e.g. display name). */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const firstNameInput = sanitizeOptionalName(req.body.firstName);
    const lastNameInput = sanitizeOptionalName(req.body.lastName);
    const fallbackNameInput = sanitizeOptionalName(req.body.name);

    let firstName = firstNameInput;
    let lastName = lastNameInput;

    if (!firstName && !lastName && fallbackNameInput) {
      const parsed = splitFullName(fallbackNameInput);
      firstName = parsed.firstName;
      lastName = parsed.lastName;
    }

    if (!firstName) {
      return res.status(400).json({ error: 'firstName is required' });
    }
    const lastUpdated = req.user.lastNameUpdatedAt;
    if (lastUpdated) {
      const elapsed = Date.now() - new Date(lastUpdated).getTime();
      if (elapsed < NAME_CHANGE_COOLDOWN_MS) {
        return res.status(400).json({
          error: 'You can only change your name once every 14 days.',
        });
      }
    }
    req.user.firstName = firstName;
    req.user.lastName = lastName || null;
    req.user.name = [firstName, lastName].filter(Boolean).join(' ');
    req.user.lastNameUpdatedAt = new Date();
    await req.user.save();
    res.json({
      user: {
        id: req.user._id,
        email: req.user.email || undefined,
        ...getUserNameFields(req.user),
        partnerId: req.user.partnerId ?? null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
