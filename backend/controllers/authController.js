const appleSignin = require('apple-signin-auth');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config');

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
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

exports.appleLogin = async (req, res) => {
  try {
    const { identityToken, email, firstName, lastName } = req.body;

    if (!identityToken || typeof identityToken !== 'string') {
      return res.status(400).json({ error: 'identityToken is required' });
    }

    if (!process.env.APPLE_CLIENT_ID) {
      return res.status(503).json({
        error: 'Sign in with Apple not configured. Set APPLE_CLIENT_ID in backend .env.',
      });
    }

    let payload;
    try {
      payload = await appleSignin.verifyIdToken(identityToken, {
        audience: process.env.APPLE_CLIENT_ID,
        ignoreExpiration: true,
      });
    } catch (err) {
      return res.status(401).json({
        error: 'Invalid or expired Apple identity token',
        details: err.message,
      });
    }

    const appleSub = payload.sub;

    let user = await User.findOne({
      $or: [{ appleId: appleSub }, { oauthProvider: 'apple', oauthId: appleSub }],
    });

    if (!user) {
      const emailToSave =
        typeof email === 'string' && email.trim()
          ? email.trim().toLowerCase()
          : payload.email || null;
      const firstNameToSave = sanitizeOptionalName(firstName);
      const lastNameToSave = sanitizeOptionalName(lastName);
      const nameToSave = [firstNameToSave, lastNameToSave].filter(Boolean).join(' ') || null;

      user = await User.create({
        oauthProvider: 'apple',
        oauthId: appleSub,
        appleId: appleSub,
        email: emailToSave,
        ...(firstNameToSave && { firstName: firstNameToSave }),
        ...(lastNameToSave && { lastName: lastNameToSave }),
        ...(nameToSave && { name: nameToSave }),
      });
    }
    if (!user.appleId) {
      user.appleId = appleSub;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    const parsed = splitFullName(user.name);
    const firstNameResolved = user.firstName || parsed.firstName;
    const lastNameResolved = user.lastName || parsed.lastName;

    res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email || undefined,
        firstName: firstNameResolved || undefined,
        lastName: lastNameResolved || undefined,
        name: [firstNameResolved, lastNameResolved].filter(Boolean).join(' ') || user.name || undefined,
        partnerId: user.partnerId ?? null,
        createdAt: user.createdAt ? user.createdAt.toISOString() : undefined,
      },
    });
  } catch (err) {
    console.error('Apple login error:', err);
    res.status(500).json({ error: err.message || 'Apple sign-in failed' });
  }
};
