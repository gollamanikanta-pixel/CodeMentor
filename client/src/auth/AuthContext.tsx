import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  fetchCsrfToken,
  getCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
  type AccountUser,
} from '../api/client';

type AuthContextValue = {
  user: AccountUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (payload: { email: string; password: string; remember?: boolean }) => Promise<{ ok: boolean; message?: string }>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    acceptedTerms: boolean;
  }) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Optional account state. Local-first learning never depends on this context —
 * it only unlocks server-side project sync and the multi-file workspace.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const current = await getCurrentUser();
    setUser(current);
  }, []);

  useEffect(() => {
    void (async () => {
      // Warm the CSRF cookie so the first state-changing request succeeds.
      await fetchCsrfToken().catch(() => '');
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback<AuthContextValue['login']>(async (payload) => {
    const { ok, data } = await loginAccount(payload);
    if (ok) {
      setUser(data.user);
      return { ok: true };
    }
    return { ok: false, message: data.message };
  }, []);

  const register = useCallback<AuthContextValue['register']>(async (payload) => {
    const { ok, data } = await registerAccount(payload);
    if (ok) {
      setUser(data.user);
      return { ok: true };
    }
    return { ok: false, message: data.message };
  }, []);

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, login, register, logout }), [user, loading, refresh, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
