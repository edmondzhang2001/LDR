const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const BUCKET = process.env.S3_BUCKET || 'ldr-uploads';
const REGION = process.env.AWS_REGION || 'us-east-1';
const EXPIRY_SECONDS = 3600; // 1 hour

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

function sanitizeFilename(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const basename = name.replace(/^.*[/\\]/, '').trim();
  const safe = basename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  return safe || 'file';
}

router.post('/presigned-url', requireAuth, async (req, res) => {
  try {
    if (!s3Client) {
      return res.status(503).json({ error: 'S3 not configured' });
    }
    const { filename, contentType } = req.body;
    if (!filename || !contentType) {
      return res.status(400).json({
        error: 'filename and contentType are required',
      });
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({ error: 'contentType not allowed' });
    }
    const safeName = sanitizeFilename(filename);
    const key = `uploads/${req.user._id}/${Date.now()}-${safeName}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: EXPIRY_SECONDS,
    });
    res.json({ url, key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
