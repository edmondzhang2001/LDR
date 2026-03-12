const crypto = require('crypto');
const express = require('express');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');

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

/** GET /api/user/partner — fetch current user's partner profile (safe fields only). */
router.get('/partner', requireAuth, async (req, res) => {
  try {
    const partnerId = req.user.partnerId;
    if (!partnerId) {
      return res.status(404).json({ error: 'No partner linked' });
    }
    const partner = await User.findById(partnerId)
      .select('name email location batteryLevel lastUpdatedDataAt reunion photos timezone mood')
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
        name: partner.name || undefined,
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
        console.error('[photo thumbnail]', thumbErr?.message || thumbErr);
      }
    }
    await req.user.save();
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

/** PUT /api/user/mood — update current user mood (emoji + optional text). */
router.put('/mood', requireAuth, async (req, res) => {
  try {
    const { emoji, text } = req.body;
    req.user.mood = req.user.mood || {};
    req.user.mood.emoji = typeof emoji === 'string' && emoji.trim() ? emoji.trim() : null;
    req.user.mood.text = typeof text === 'string' && text.trim() ? text.trim().slice(0, 15) : null;
    await req.user.save();
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
    req.user.isPremium = !!hasPremium;
    await req.user.save();
    res.json({ ok: true, isPremium: req.user.isPremium });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/user/profile — update current user profile (e.g. display name). */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (typeof name !== 'string') {
      return res.status(400).json({ error: 'name must be a string' });
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'name is required' });
    }
    req.user.name = trimmed;
    await req.user.save();
    res.json({
      user: {
        id: req.user._id,
        email: req.user.email || undefined,
        name: req.user.name || undefined,
        partnerId: req.user.partnerId ?? null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
