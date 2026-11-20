import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth.js';
import { SIGNED_OUT_EVENT, tokenStore } from '../api/http.js';

const AuthContext = createContext(null);

// status: 'loading' (checking a stored token) | 'ready' | 'error' (server unreachable)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const restore = useCallback(async () => {
    if (!tokenStore.get()) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const { user: me } = await authApi.me();
      setUser(me);
      setStatus('ready');
    } catch (err) {
      if (err?.response?.status === 401) {
        // The http interceptor already cleared the token.
        setUser(null);
        setStatus('ready');
      } else {
        // Server down or offline: keep the token and let the user retry.
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  useEffect(() => {
    const onSignedOut = () => setUser(null);
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  const finishAuth = useCallback(({ token, user: nextUser }) => {
    tokenStore.set(token);
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback((credentials) => authApi.login(credentials).then(finishAuth), [finishAuth]);
  const register = useCallback((payload) => authApi.register(payload).then(finishAuth), [finishAuth]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Re-read the user (e.g. after the pro's verification status changes).
  const refreshUser = useCallback(async () => {
    const { user: me } = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout, refreshUser, retry: restore }),
    [user, status, login, register, logout, refreshUser, restore],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
