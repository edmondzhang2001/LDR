const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const appleSignin = require('apple-signin-auth');
const User = require('../models/User');
const { JWT_SECRET } = require('../config');
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();
const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

function sanitizeOptionalName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function splitFullName(fullName) {
  const trimmed = sanitizeOptionalName(fullName);
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function getResolvedNames({ firstName, lastName, fullName }) {
  const first = sanitizeOptionalName(firstName);
  const last = sanitizeOptionalName(lastName);
  if (first || last) {
    return {
      firstName: first,
      lastName: last,
      name: [first, last].filter(Boolean).join(' ') || null,
    };
  }
  const parsed = splitFullName(fullName);
  return {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    name: [parsed.firstName, parsed.lastName].filter(Boolean).join(' ') || null,
  };
}

function getUserNameFields(user) {
  const firstName = user.firstName || null;
  const lastName = user.lastName || null;
  if (firstName || lastName) {
    return {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
    };
  }
  const parsed = splitFullName(user.name);
  return {
    firstName: parsed.firstName || undefined,
    lastName: parsed.lastName || undefined,
    name: sanitizeOptionalName(user.name) || undefined,
  };
}

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

async function verifyAppleToken(identityToken) {
  const appleClientId = process.env.APPLE_CLIENT_ID || process.env.APPLE_SERVICE_ID;
  const payload = await appleSignin.verifyIdToken(identityToken, {
    audience: appleClientId,
    ignoreExpiration: false,
  });
  return {
    sub: payload.sub,
    email: payload.email || null,
  };
}

async function verifyGoogleToken(identityToken) {
  if (!googleClient) {
    throw new Error('Google OAuth not configured');
  }
  const ticket = await googleClient.verifyIdToken({
    idToken: identityToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    sub: payload.sub,
    email: payload.email || null,
  };
}

router.get('/me', requireAuth, async (req, res) => {
  try {
    // requireAuth already loads user from DB; re-verify so /me explicitly fails if user was deleted
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    let partner = null;
    if (user.partnerId) {
      partner = await User.findById(user.partnerId).select('isPremium').lean();
    }
    const hasPremiumAccess = Boolean(user.isPremium || (partner && partner.isPremium));
    const reunion =
      user.reunion?.startDate != null
        ? {
            startDate: user.reunion.startDate.toISOString(),
            endDate: user.reunion.endDate
              ? user.reunion.endDate.toISOString()
              : null,
          }
        : null;
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const photos = (user.photos || [])
      .filter((p) => new Date(p.createdAt) >= cutoff24h)
      .map((p) => ({ url: p.url, createdAt: p.createdAt.toISOString(), caption: p.caption || '' }));
    res.json({
      user: {
        id: user._id,
        email: user.email || undefined,
        ...getUserNameFields(user),
        partnerId: user.partnerId ?? null,
        reunion,
        photos,
        timezone: user.timezone || undefined,
        mood:
          user.mood?.emoji != null || user.mood?.text != null
            ? { emoji: user.mood.emoji || undefined, text: user.mood.text || undefined }
            : undefined,
        hasPremiumAccess,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/apple', authController.appleLogin);

router.post('/oauth', async (req, res) => {
  try {
    const {
      identityToken,
      provider,
      name: nameFromClient,
      firstName: firstNameFromClient,
      lastName: lastNameFromClient,
      email: emailFromClient,
    } = req.body;
    console.log('POST /oauth received, provider:', provider);
    if (!identityToken || typeof identityToken !== 'string') {
      return res.status(400).json({ error: 'identityToken is required' });
    }
    if (!provider || !['apple', 'google'].includes(provider)) {
      return res.status(400).json({ error: 'provider must be "apple" or "google"' });
    }
    if (provider === 'apple' && !process.env.APPLE_CLIENT_ID) {
      return res.status(503).json({
        error: 'Sign in with Apple not configured. Set APPLE_CLIENT_ID in backend .env (use your iOS app bundle identifier, e.g. com.anonymous.frontend).',
      });
    }
    if (provider === 'google' && !process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        error: 'Google Sign-In not configured. Set GOOGLE_CLIENT_ID in backend .env (use your Google Web OAuth client ID).',
      });
    }

    let payload;
    try {
      if (provider === 'apple') {
        payload = await verifyAppleToken(identityToken);
      } else {
        payload = await verifyGoogleToken(identityToken);
      }
    } catch (err) {
      return res.status(401).json({
        error: 'Invalid or expired sign-in token',
        details: err.message,
      });
    }

    const oauthId = payload.sub;
    const email =
      payload.email ||
      (typeof emailFromClient === 'string' && emailFromClient.trim() ? emailFromClient.trim() : null) ||
      null;
    const resolvedNames = getResolvedNames({
      firstName: firstNameFromClient,
      lastName: lastNameFromClient,
      fullName: nameFromClient,
    });

    let user = await User.findOne({ oauthId });
    if (!user) {
      user = await User.create({
        oauthProvider: provider,
        oauthId,
        email,
        ...(resolvedNames.name && { name: resolvedNames.name }),
        ...(resolvedNames.firstName && { firstName: resolvedNames.firstName }),
        ...(resolvedNames.lastName && { lastName: resolvedNames.lastName }),
      });
    } else if (
      resolvedNames.name &&
      (!user.name || !user.firstName || (!user.lastName && resolvedNames.lastName))
    ) {
      if (!user.name) user.name = resolvedNames.name;
      if (!user.firstName && resolvedNames.firstName) user.firstName = resolvedNames.firstName;
      if (!user.lastName && resolvedNames.lastName) user.lastName = resolvedNames.lastName;
      await user.save();
    }

    const token = signToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email || undefined,
        ...getUserNameFields(user),
        partnerId: user.partnerId ?? null,
      },
    });
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).json({ error: err.message || 'Authentication failed' });
  }
});

module.exports = router;
module.exports.signToken = signToken;
