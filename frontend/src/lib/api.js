import axios from 'axios';

const API_BASE = 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
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
      if (err.response?.status === 401 && typeof logoutFn === 'function') logoutFn();
      return Promise.reject(err);
    }
  );
}

/** GET /api/auth/me — refresh current user (e.g. after pairing). */
export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
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
