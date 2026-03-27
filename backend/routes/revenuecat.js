const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const OnboardingSession = require('../models/OnboardingSession');

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

/** Resolve a MongoDB ObjectId from RevenueCat event (app_user_id, original_app_user_id, or aliases). */
function resolveAppUserId(event) {
  const candidates = [
    event?.app_user_id,
    event?.original_app_user_id,
    ...(Array.isArray(event?.aliases) ? event.aliases : []),
  ].filter(Boolean);
  const id = candidates.find((c) => mongoose.Types.ObjectId.isValid(String(c)));
  return id ? String(id) : null;
}

async function updateLatestOnboardingSessionFromWebhook({ userId, converted, sourceEvent }) {
  if (!userId) return;
  await OnboardingSession.findOneAndUpdate(
    { userId },
    {
      $set: {
        subscriptionConverted: converted,
        subscriptionCheckedAt: new Date(),
        subscriptionSource: 'revenuecat_webhook',
        paywallResult: sourceEvent || null,
      },
    },
    { sort: { createdAt: -1 } }
  );
}

/**
 * RevenueCat webhook: receive subscription events and sync isPremium to our User model.
 * Payload may be the event object at top level or under body.event. app_user_id is our MongoDB User _id.
 * Set REVENUECAT_WEBHOOK_SECRET in env and the same value as Authorization header in RevenueCat dashboard.
 */
router.post('/revenuecat', requireWebhookAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const event = body.event || body;
    const type = event?.type ?? body?.type;

    if (!type) {
      console.warn('[RevenueCat webhook] Missing type in payload');
      return res.status(400).json({ error: 'Missing type' });
    }

    const appUserId = resolveAppUserId(event);
    if (!appUserId) {
      console.warn('[RevenueCat webhook] No valid MongoDB app_user_id in event', {
        type,
        app_user_id: event?.app_user_id,
        original_app_user_id: event?.original_app_user_id,
      });
      return res.status(200).json({ received: true });
    }

    const grantAccess =
      type === 'INITIAL_PURCHASE' ||
      type === 'RENEWAL' ||
      type === 'TEMPORARY_ENTITLEMENT_GRANT' ||
      type === 'UNCANCELLATION';
    const revokeAccess = type === 'EXPIRATION' || type === 'CANCELLATION';

    if (grantAccess) {
      const u = await User.findByIdAndUpdate(appUserId, { isPremium: true });
      if (!u) {
        console.warn('[RevenueCat webhook] User not found for app_user_id', appUserId);
      } else {
        console.log('[RevenueCat webhook] Set isPremium=true for user', appUserId, 'event:', type);
      }
      const purchaser = await User.findById(appUserId).select('partnerId').lean();
      if (purchaser?.partnerId) {
        await User.findByIdAndUpdate(purchaser.partnerId, { isPremium: true });
      }
      await updateLatestOnboardingSessionFromWebhook({
        userId: appUserId,
        converted: true,
        sourceEvent: type,
      });
    } else if (revokeAccess) {
      await User.findByIdAndUpdate(appUserId, { isPremium: false });
      const purchaser = await User.findById(appUserId).select('partnerId').lean();
      if (purchaser?.partnerId) {
        await User.findByIdAndUpdate(purchaser.partnerId, { isPremium: false });
      }
      await updateLatestOnboardingSessionFromWebhook({
        userId: appUserId,
        converted: false,
        sourceEvent: type,
      });
      console.log('[RevenueCat webhook] Set isPremium=false for user', appUserId, 'event:', type);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('RevenueCat webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
