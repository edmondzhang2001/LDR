const crypto = require('crypto');
const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const { getExpoPush } = require('../lib/expoPush');

const router = express.Router();
const BUCKET = process.env.S3_BUCKET_NAME || 'ldr-uploads';
const REGION = process.env.AWS_REGION || 'us-east-1';
const EXPIRY_SECONDS = 3600;
/** Max photos returned per side (user / partner) for history payloads. */
const MAX_HISTORY_PHOTOS_PER_SIDE = 500;

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

/** GET /api/photo/today — photos sent by current user in last 24 hours, sorted newest first. */
router.get('/today', requireAuth, async (req, res) => {
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const photos = (req.user.photos || [])
      .filter((p) => new Date(p.createdAt) >= cutoff24h)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((p) => ({
        id: p._id.toString(),
        url: p.url,
        thumbnailUrl: p.thumbnailUrl || undefined,
        createdAt: new Date(p.createdAt).toISOString(),
        caption: p.caption || '',
      }));
    res.json({ photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function mapPhotoForHistory(p) {
  if (!p || !p.url) return null;
  return {
    id: p._id.toString(),
    url: p.url,
    thumbnailUrl: p.thumbnailUrl || undefined,
    createdAt: new Date(p.createdAt).toISOString(),
    caption: p.caption || '',
  };
}

/** GET /api/photo/history — all stored Daily Story photos for you and your partner (for calendar). */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const mine = (req.user.photos || [])
      .filter((p) => p?.url)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, MAX_HISTORY_PHOTOS_PER_SIDE)
      .map(mapPhotoForHistory)
      .filter(Boolean);

    let partner = [];
    const partnerId = req.user.partnerId;
    if (partnerId) {
      const partnerUser = await User.findById(partnerId).select('photos').lean();
      partner = (partnerUser?.photos || [])
        .filter((p) => p?.url)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, MAX_HISTORY_PHOTOS_PER_SIDE)
        .map((p) => ({
          id: p._id.toString(),
          url: p.url,
          thumbnailUrl: p.thumbnailUrl || undefined,
          createdAt: new Date(p.createdAt).toISOString(),
          caption: p.caption || '',
        }));
    }

    res.json({ mine, partner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/** DELETE /api/photo/:photoId — delete a photo. If it was partner's widget photo, push update to partner. */
router.delete('/:photoId', requireAuth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const photo = req.user.photos?.id(photoId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    const deletedUrl = photo.thumbnailUrl || photo.url;
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const in24h = (req.user.photos || []).filter((p) => new Date(p.createdAt) >= cutoff24h).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const wasWidgetPhoto = in24h.length > 0 && (in24h[0].thumbnailUrl || in24h[0].url) === deletedUrl;

    req.user.photos.pull(photoId);
    await req.user.save();

    const partnerId = req.user.partnerId;
    if (wasWidgetPhoto && partnerId) {
      try {
        const { Expo, expoPush } = await getExpoPush();
        const partner = await User.findById(partnerId).select('pushToken').lean();
        const pushToken = partner?.pushToken;
        if (pushToken && Expo.isExpoPushToken(pushToken)) {
          const remaining = (req.user.photos || []).filter((p) => new Date(p.createdAt) >= cutoff24h).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          const nextUrl = remaining.length > 0 ? (remaining[0].thumbnailUrl || remaining[0].url) : null;
          await expoPush.sendPushNotificationsAsync([
            {
              to: pushToken,
              data: { photoUrl: nextUrl ?? '', type: 'widget_update' },
              mutableContent: true,
              _mutableContent: true,
              contentAvailable: true,
              _contentAvailable: true,
            },
          ]);
        }
      } catch (pushErr) {
        console.error('[photo delete push]', pushErr?.message || pushErr);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/photo/presigned-url — generate presigned PUT URL and final URL for Daily Story upload. */
router.get('/presigned-url', requireAuth, async (req, res) => {
  try {
    if (!s3Client) {
      return res.status(503).json({ error: 'S3 not configured' });
    }
    const key = `photos/${req.user._id}/${Date.now()}-${crypto.randomUUID()}.jpg`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: 'image/jpeg',
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: EXPIRY_SECONDS });
    const finalUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
    res.json({ url, key, finalUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
