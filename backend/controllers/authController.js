const appleSignin = require('apple-signin-auth');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config');

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
      const nameParts = [];
      if (typeof firstName === 'string' && firstName.trim()) nameParts.push(firstName.trim());
      if (typeof lastName === 'string' && lastName.trim()) nameParts.push(lastName.trim());
      const nameToSave = nameParts.length ? nameParts.join(' ') : null;

      user = await User.create({
        oauthProvider: 'apple',
        oauthId: appleSub,
        appleId: appleSub,
        email: emailToSave,
        ...(nameToSave && { name: nameToSave }),
      });
    }
    if (!user.appleId) {
      user.appleId = appleSub;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email || undefined,
        name: user.name || undefined,
        partnerId: user.partnerId ?? null,
      },
    });
  } catch (err) {
    console.error('Apple login error:', err);
    res.status(500).json({ error: err.message || 'Apple sign-in failed' });
  }
};
