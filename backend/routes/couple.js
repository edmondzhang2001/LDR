const express = require('express');
const User = require('../models/User');
const Couple = require('../models/Couple');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/pair/generate', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.partnerId) {
      return res.status(400).json({ error: 'Already paired' });
    }
    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
    await User.findByIdAndUpdate(user._id, {
      pairingCode: code,
      pairingCodeExpiresAt: expiresAt,
    });
    res.json({ code, expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pair/join', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !/^\d{6}$/.test(String(code).trim())) {
      return res.status(400).json({ error: 'Valid 6-digit code required' });
    }
    const joiner = req.user;
    if (joiner.partnerId) {
      return res.status(400).json({ error: 'Already paired' });
    }
    const creator = await User.findOne({
      pairingCode: String(code).trim(),
      pairingCodeExpiresAt: { $gt: new Date() },
      _id: { $ne: joiner._id },
    })
      .select('+pairingCode +pairingCodeExpiresAt')
      .exec();
    if (!creator) {
      return res.status(404).json({ error: 'Invalid or expired code' });
    }
    if (creator.partnerId) {
      return res.status(400).json({ error: 'That user is already paired' });
    }
    const couple = await Couple.create({
      user1: creator._id,
      user2: joiner._id,
    });
    await User.findByIdAndUpdate(creator._id, {
      partnerId: joiner._id,
      pairingCode: null,
      pairingCodeExpiresAt: null,
    });
    await User.findByIdAndUpdate(joiner._id, { partnerId: creator._id });
    const hasPremiumAccess = Boolean(joiner.isPremium || creator.isPremium);
    res.status(201).json({
      coupleId: couple._id,
      partnerId: creator._id,
      hasPremiumAccess,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
