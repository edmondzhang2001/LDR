const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');

const router = express.Router();

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

function requireWebhookAuth(req, res, next) {
  if (!WEBHOOK_SECRET) {
    console.warn('REVENUECAT_WEBHOOK_SECRET not set — webhook is insecure');
    return next();
  }
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || token !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/**
 * RevenueCat webhook: receive subscription events and sync isPremium to our User model.
 * Payload is the event object (type, app_user_id, etc.). app_user_id is our MongoDB User _id.
 * Set REVENUECAT_WEBHOOK_SECRET in env and the same value as Authorization header in RevenueCat dashboard.
 */
router.post('/revenuecat', requireWebhookAuth, async (req, res) => {
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
