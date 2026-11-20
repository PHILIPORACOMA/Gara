import axios from 'axios';

const TOKEN_KEY = 'gara_token';

// localStorage can throw (private mode, blocked storage); never let that break the app.
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4310/api',
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or revoked token: drop it and tell the app to sign out. Wrong credentials on the
// login form also return 401, but then there is no stored token, so nothing happens here.
export const SIGNED_OUT_EVENT = 'gara:signed-out';

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
    }
    return Promise.reject(error);
  },
);

// The API always answers errors as { error: { code, message, details? } }.
export function apiErrorMessage(err) {
  const apiMessage = err?.response?.data?.error?.message;
  if (apiMessage) return apiMessage;
  if (err?.code === 'ERR_NETWORK' || err?.code === 'ECONNABORTED') {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

// Zod validation failures come back as details: [{ field, message }]. Returns { field: message }.
export function apiFieldErrors(err) {
  const details = err?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.map((d) => [d.field, d.message]));
}
