const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-secret') {
  console.warn('Security: Set JWT_SECRET in production. Default secret allows token forgery.');
}
module.exports = { JWT_SECRET };
