import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PublicUser } from '@stepsmart/shared-types';
import { AuthApi } from './endpoints';
import { clearToken, getStoredToken, saveToken } from './storage';
import { setUnauthorizedHandler } from './api';

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, timezone: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const token = await getStoredToken();
      if (token) {
        const me = await AuthApi.me();
        setUser(me);
      }
    } catch {
      await clearToken();
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const result = await AuthApi.login({ email, password });
    await saveToken(result.accessToken);
    setUser(result.user);
  }

  async function register(email: string, username: string, password: string, timezone: string) {
    const result = await AuthApi.register({ email, username, password, timezone });
    await saveToken(result.accessToken);
    setUser(result.user);
  }

  async function logout() {
    await clearToken();
    setUser(null);
  }

  const value = useMemo(() => ({ user, isLoading, login, register, logout }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
