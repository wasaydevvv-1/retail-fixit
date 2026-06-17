import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUserResponse, Permission } from '@retailfixit/shared';

import { apiFetch, setAccessToken } from '../../lib/api-client.js';
import { isEntraConfiguredOnWeb } from './auth-config.js';
import { loginInteractive, logoutInteractive, tryRestoreEntraSession } from './msal-client.js';

type AuthMode = 'entra' | 'dev' | 'loading';

interface DevUserOption {
  id: string;
  displayName: string;
  roles: string[];
}

interface AuthContextValue {
  mode: AuthMode;
  user: AuthUserResponse | null;
  isLoading: boolean;
  devUsers: DevUserOption[];
  loginWithEntra: () => Promise<void>;
  loginWithDevUser: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  loadCurrentUser: () => Promise<void>;
  claimAdmin: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
  /** True when the signed-in user holds the given permission (RBAC UI gate). */
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('loading');
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [devUsers, setDevUsers] = useState<DevUserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    try {
      const me = await apiFetch<AuthUserResponse>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  const claimAdmin = useCallback(async () => {
    const me = await apiFetch<AuthUserResponse>('/auth/claim-admin', { method: 'POST' });
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const config = await apiFetch<{ mode: 'entra' | 'dev' }>('/auth/config');
        if (cancelled) return;

        if (config.mode === 'entra') {
          if (!isEntraConfiguredOnWeb()) {
            console.error('API is in Entra mode but VITE_AZURE_AD_* env vars are missing on the web app');
            setMode('entra');
          } else {
            setMode('entra');
            const token = await tryRestoreEntraSession();
            if (token && !cancelled) {
              setAccessToken(token);
              await loadCurrentUser();
            }
          }
        } else {
          setMode('dev');
          const users = await apiFetch<DevUserOption[]>('/auth/dev/users');
          if (!cancelled) setDevUsers(users);

          const stored = sessionStorage.getItem('rfi_token');
          if (stored) {
            setAccessToken(stored);
            await loadCurrentUser();
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loadCurrentUser]);

  const loginWithEntra = useCallback(async () => {
    const result = await loginInteractive();
    if (!result.accessToken) {
      throw new Error('No access token returned. Check API scope and permissions.');
    }
    setAccessToken(result.accessToken);
    const me = await apiFetch<AuthUserResponse>('/auth/me');
    setUser(me);
  }, []);

  const loginWithDevUser = useCallback(async (userId: string) => {
    const session = await apiFetch<{ token: string; user: AuthUserResponse }>('/auth/dev/login', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    setAccessToken(session.token);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    setAccessToken(null);
    setUser(null);
    if (mode === 'entra') {
      await logoutInteractive();
    }
  }, [mode]);

  const hasRole = useCallback(
    (...roles: string[]) => user?.roles.some((r) => roles.includes(r)) ?? false,
    [user],
  );

  const can = useCallback(
    (permission: Permission) => user?.permissions.includes(permission) ?? false,
    [user],
  );

  const value = useMemo(
    () => ({
      mode,
      user,
      isLoading,
      devUsers,
      loginWithEntra,
      loginWithDevUser,
      logout,
      loadCurrentUser,
      claimAdmin,
      hasRole,
      can,
    }),
    [mode, user, isLoading, devUsers, loginWithEntra, loginWithDevUser, logout, loadCurrentUser, claimAdmin, hasRole, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
