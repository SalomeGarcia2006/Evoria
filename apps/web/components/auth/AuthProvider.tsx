'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getCurrentUser,
  login,
  logout,
  changeTenant,
  type LoginPayload,
} from '../../services/auth.service';
import type { AuthUser } from '../../types/auth';

export type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  can: (permission: string) => boolean;
  signIn: (payload: LoginPayload) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  selectTenant: (tenantId: string | null) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRequestId = useRef(0);

  const refreshSession = useCallback(async () => {
    const requestId = ++sessionRequestId.current;

    try {
      const currentUser = await getCurrentUser();
      if (requestId === sessionRequestId.current) setUser(currentUser);
    } catch {
      if (requestId === sessionRequestId.current) setUser(null);
    } finally {
      if (requestId === sessionRequestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const requestId = ++sessionRequestId.current;

    getCurrentUser()
      .then((currentUser) => {
        if (isMounted && requestId === sessionRequestId.current) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (isMounted && requestId === sessionRequestId.current) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted && requestId === sessionRequestId.current) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      can: (permission) =>
        (permission === 'empresas.ver' && !!user?.isDeveloper) ||
        (user?.permissions.includes(permission) ?? false),
      selectTenant: async (tenantId) => {
        const session = await changeTenant(tenantId);
        ++sessionRequestId.current;
        setUser({
          ...session,
          isDeveloper: user?.isDeveloper ?? session.isDeveloper,
        });
      },
      signIn: async (payload) => {
        const session = await login(payload);
        ++sessionRequestId.current;
        setUser(session);
        setIsLoading(false);

        return session;
      },
      signOut: async () => {
        try {
          await logout();
        } finally {
          ++sessionRequestId.current;
          setUser(null);
          setIsLoading(false);
        }
      },
      refreshSession,
    }),
    [isLoading, refreshSession, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
