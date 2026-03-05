const crypto = require('crypto');
const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const BUCKET = process.env.S3_BUCKET_NAME || 'ldr-uploads';
const REGION = process.env.AWS_REGION || 'us-east-1';
const EXPIRY_SECONDS = 3600;

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
