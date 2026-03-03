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
