const { rateLimit } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * General API rate limit — applies to all /api/* except webhooks.
 * Configurable via RATE_LIMIT_MAX (default 200 per 15 min per IP).
 */
function createGeneralLimiter() {
  const max = parseInt(process.env.RATE_LIMIT_MAX, 10) || 200;
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: max,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/webhooks'),
  });
}

/**
 * Stricter limit for auth login endpoints (OAuth, Apple) to reduce brute force / credential stuffing.
 * Configurable via RATE_LIMIT_AUTH_MAX (default 15 per 15 min per IP).
 */
function createAuthLoginLimiter() {
  const max = parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 15;
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: max,
    message: { error: 'Too many sign-in attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * Stricter limit for pairing (generate code, join with code) to prevent abuse and code guessing.
 * Configurable via RATE_LIMIT_PAIRING_MAX (default 20 per 15 min per IP).
 */
function createPairingLimiter() {
  const max = parseInt(process.env.RATE_LIMIT_PAIRING_MAX, 10) || 20;
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: max,
    message: { error: 'Too many pairing attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

module.exports = {
  createGeneralLimiter,
  createAuthLoginLimiter,
  createPairingLimiter,
};
