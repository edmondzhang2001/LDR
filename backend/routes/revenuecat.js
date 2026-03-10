const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');

const router = express.Router();

/**
 * RevenueCat webhook: receive subscription events and sync isPremium to our User model.
 * Payload is the event object (type, app_user_id, etc.). app_user_id is our MongoDB User _id.
 */
router.post('/revenuecat', async (req, res) => {
  try {
    const event = req.body?.event ?? req.body;
    const appUserId = event?.app_user_id ?? req.body?.app_user_id;
    const type = event?.type ?? req.body?.type;

    if (!appUserId || !type) {
      return res.status(400).json({ error: 'Missing app_user_id or type' });
    }

    if (!mongoose.Types.ObjectId.isValid(appUserId)) {
      return res.status(200).json({ received: true });
    }

    const grantAccess = type === 'INITIAL_PURCHASE' || type === 'RENEWAL';
    const revokeAccess = type === 'EXPIRATION' || type === 'CANCELLATION';

    if (grantAccess) {
      await User.findByIdAndUpdate(appUserId, { isPremium: true });
    } else if (revokeAccess) {
      await User.findByIdAndUpdate(appUserId, { isPremium: false });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('RevenueCat webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
