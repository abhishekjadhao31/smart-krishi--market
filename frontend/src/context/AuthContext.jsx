import { createContext, useContext, useEffect, useState } from 'react';
import { loginUser, registerUser } from '../api/auth.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'skm_token';
const USER_KEY = 'skm_user';

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

function hydrateUserFromStorage() {
  const storedUser = safeJsonParse(localStorage.getItem(USER_KEY));
  const storedToken = localStorage.getItem(TOKEN_KEY);
  const tokenUser = decodeJwtPayload(storedToken);
  if (!tokenUser) return storedUser;

  return {
    ...(storedUser || {}),
    id: storedUser?.id ?? tokenUser.sub,
    email: storedUser?.email ?? tokenUser.email,
    role: tokenUser.role,
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(hydrateUserFromStorage);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    const tokenUser = decodeJwtPayload(token);
    if (!tokenUser) return;
    setUser((current) => ({
      ...(current || {}),
      id: current?.id ?? tokenUser.sub,
      email: current?.email ?? tokenUser.email,
      role: tokenUser.role,
    }));
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  // Persist user + token on successful login/register.
  const login = async (credentials) => {
    setLoading(true);
    try {
      const { data } = await loginUser(credentials);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const { data } = await registerUser(payload);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, isAuthenticated: !!token }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
