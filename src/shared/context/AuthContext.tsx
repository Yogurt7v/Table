import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { pb } from '@/api/client';
import type { IUser } from '@/shared/types';
import { setLastKnownUser } from '@/shared/auth/last-known-user';
import { resumeSession, onSessionExpired, isSessionExpired } from '@/shared/auth/session';
import { SessionExpiredModal } from '@/shared/auth/SessionExpiredModal';

interface AuthContextValue {
  user: IUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  reauthenticate: (loginValue: string, passwordValue: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<IUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(() => isSessionExpired());

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, model) => {
      if (model) {
        const u = model as unknown as IUser;
        setUser(u);
        setLastKnownUser(u);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    }, true);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSessionExpired(() => {
      if (location.pathname === '/login') {
        navigate('/login', { replace: true, state: { reason: 'expired', from: location.state?.from } });
        return;
      }
      setSessionExpired(true);
    });
    return unsub;
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (sessionExpired && location.pathname === '/login') {
      setSessionExpired(false);
    }
  }, [sessionExpired, location.pathname]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== pb.authStore.storageKey) return;
      if (!pb.authStore.token) {
        setUser(null);
        setSessionExpired(false);
        return;
      }
      if (isSessionExpired()) {
        setSessionExpired(true);
      } else {
        setSessionExpired(false);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(async (loginValue: string, password: string) => {
    const result = await pb.collection('users').authWithPassword<IUser>(loginValue, password);
    setUser(result.record);
    setLastKnownUser(result.record);
    resumeSession();
    setSessionExpired(false);
  }, []);

  const reauthenticate = useCallback(async (loginValue: string, passwordValue: string) => {
    const result = await pb.collection('users').authWithPassword<IUser>(loginValue, passwordValue);
    setUser(result.record);
    setLastKnownUser(result.record);
    resumeSession();
    setSessionExpired(false);
    notifications.show({ color: 'green', message: 'Сессия восстановлена, повторите действие.' });
  }, []);

  const logout = useCallback(() => {
    const from = location.pathname !== '/login' ? { pathname: location.pathname } : location.state?.from;
    pb.authStore.clear();
    setUser(null);
    setLastKnownUser(null);
    resumeSession();
    setSessionExpired(false);
    navigate('/login', { replace: true, state: { reason: 'expired', from } });
  }, [navigate, location.pathname, location.state]);

  const showExpiredModal = sessionExpired && location.pathname !== '/login' && !!pb.authStore.token;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        sessionExpired,
        login,
        logout,
        reauthenticate,
      }}
    >
      {children}
      {showExpiredModal && (
        <SessionExpiredModal
          opened={showExpiredModal}
          onClose={logout}
          onAuthenticated={() => {
            setSessionExpired(false);
          }}
        />
      )}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
