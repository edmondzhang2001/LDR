const express = require('express');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

/** PUT /api/reunion — set reunion dates for both current user and partner (keeps them in sync). */
router.put('/', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || typeof startDate !== 'string') {
      return res.status(400).json({ error: 'startDate is required (ISO string)' });
    }
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: 'startDate must be a valid date' });
    }
    const end = endDate != null && endDate !== '' ? new Date(endDate) : null;
    if (end != null && Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'endDate must be a valid date if provided' });
    }

    const reunion = { startDate: start, endDate: end };
    const userId = req.user._id;
    const partnerId = req.user.partnerId;

    await User.updateOne(
      { _id: userId },
      { $set: { reunion } }
    );

    if (partnerId) {
      await User.updateOne(
        { _id: partnerId },
        { $set: { reunion } }
      );
    }

    res.json({
      reunion: {
        startDate: reunion.startDate.toISOString(),
        endDate: reunion.endDate ? reunion.endDate.toISOString() : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/reunion — clear reunion for both current user and partner (end visit). */
router.delete('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const partnerId = req.user.partnerId;

    await User.updateOne(
      { _id: userId },
      { $set: { reunion: { startDate: null, endDate: null } } }
    );

    if (partnerId) {
      await User.updateOne(
        { _id: partnerId },
        { $set: { reunion: { startDate: null, endDate: null } } }
      );
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
