import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
    ...(API_BASE.includes('loca.lt') && { 'Bypass-Tunnel-Reminder': 'true' }),
  },
});

let authToken = null;

export function setApiToken(token) {
  authToken = token;
}

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

export function setApiLogout(logoutFn) {
  api.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err.response?.status;
      if ((status === 401 || status === 404) && typeof logoutFn === 'function') logoutFn();
      return Promise.reject(err);
    }
  );
}

/** GET /api/auth/me — refresh current user (e.g. after pairing). */
export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

/** PUT /api/user/profile — update display name. */
export async function updateProfile({ name }) {
  const { data } = await api.put('/user/profile', { name });
  return data;
}

/** GET /api/user/partner — fetch partner profile (name, location, etc.). */
export async function getPartner() {
  const { data } = await api.get('/user/partner');
  return data;
}

/** PUT /api/user/location — update current user location (city, lat, lng). */
export async function updateLocation({ city, lat, lng }) {
  await api.put('/user/location', { city, lat, lng });
}

/** PUT /api/user/battery — update current user battery level (0–1). */
export async function updateBattery(batteryLevel) {
  await api.put('/user/battery', { batteryLevel });
}

/** PUT /api/user/settings — update current user settings (e.g. timezone). */
export async function updateSettings({ timezone }) {
  await api.put('/user/settings', { timezone });
}

/** PUT /api/user/mood — update mood (emoji, text). Returns { mood }. */
export async function updateMood({ emoji, text }) {
  const { data } = await api.put('/user/mood', { emoji: emoji ?? '', text: text ?? '' });
  return data;
}

/** PUT /api/user/push-token — save Expo push token for this device (enables new-photo pushes to partner). */
export async function updatePushToken(token) {
  await api.put('/user/push-token', { pushToken: token ?? null });
}

/** POST /api/couple/pair/generate — generate 6-digit pairing code. */
export async function generatePairCode() {
  const { data } = await api.post('/couple/pair/generate');
  return data;
}

/** POST /api/couple/pair/join — join with partner using 6-digit code. */
export async function joinPair(code) {
  const { data } = await api.post('/couple/pair/join', { code: String(code).trim() });
  return data;
}

/** POST /api/couple/unlink — disconnect from partner (sets partnerId to null for both users). */
export async function unlinkPartner() {
  const { data } = await api.post('/couple/unlink');
  return data;
}

/** PUT /api/reunion — set reunion dates for both users. */
export async function saveReunion(startDate, endDate) {
  const { data } = await api.put('/reunion', {
    startDate: typeof startDate === 'string' ? startDate : new Date(startDate).toISOString(),
    endDate: endDate == null ? null : (typeof endDate === 'string' ? endDate : new Date(endDate).toISOString()),
  });
  return data;
}

/** DELETE /api/reunion — clear reunion for both users (end visit). */
export async function endReunion() {
  await api.delete('/reunion');
}

/** GET /api/photo/presigned-url — get presigned PUT URL and finalUrl for Daily Story upload. */
export async function getPresignedPhotoUrl() {
  const { data } = await api.get('/photo/presigned-url');
  return data;
}

/** POST /api/user/photo — register photo URL and optional caption after S3 upload (Daily Story). */
export async function addUserPhoto(url, caption = '') {
  const { data } = await api.post('/user/photo', { url, caption: caption ? String(caption).trim().slice(0, 60) : '' });
  return data;
}

/** GET /api/photo/today — photos sent by current user in last 24 hours. */
export async function getTodaysPhotos() {
  const { data } = await api.get('/photo/today');
  return data.photos ?? [];
}

/** DELETE /api/photo/:photoId — delete a photo. */
export async function deletePhoto(photoId) {
  await api.delete(`/photo/${encodeURIComponent(photoId)}`);
}

/** POST /api/user/sync-subscription — tell backend to set isPremium from client (self-heal after RC confirms entitlement). */
export async function syncSubscription() {
  const { data } = await api.post('/user/sync-subscription');
  return data;
}
