import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, clearToken, getToken, setToken } from '../lib/api';
import {
  type AuthUser,
  type Permission,
  userCanAccessCompany,
  userHasPermission,
} from '../lib/permissions';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  canAccessCompany: (company: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        setUser(await res.json());
      } else {
        clearToken();
        setUser(null);
      }
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    void apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearToken();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!user) return false;
      return userHasPermission(user, permission);
    },
    [user],
  );

  const canAccessCompany = useCallback(
    (company: string) => userCanAccessCompany(user, company),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, hasPermission, canAccessCompany, refreshUser }),
    [user, loading, login, logout, hasPermission, canAccessCompany, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function usePermission(permission: Permission): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}
