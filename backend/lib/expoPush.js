/** Lazy ESM load: expo-server-sdk v6+ is ESM-only; this backend is CommonJS. */
let cache = null;

async function getExpoPush() {
  if (!cache) {
    const { Expo } = await import('expo-server-sdk');
    cache = { Expo, expoPush: new Expo() };
  }
  return cache;
}

module.exports = { getExpoPush };
