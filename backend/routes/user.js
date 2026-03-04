const express = require('express');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

/** GET /api/user/partner — fetch current user's partner profile (safe fields only). */
router.get('/partner', requireAuth, async (req, res) => {
  try {
    const partnerId = req.user.partnerId;
    if (!partnerId) {
      return res.status(404).json({ error: 'No partner linked' });
    }
    const partner = await User.findById(partnerId)
      .select('name email')
      .lean();
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    res.json({
      partner: {
        id: partner._id,
        name: partner.name || undefined,
        email: partner.email || undefined,
      },
    });
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
