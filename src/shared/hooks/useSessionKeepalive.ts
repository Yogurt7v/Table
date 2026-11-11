import { useEffect } from 'react';
import { pb, AUTH_TOKEN_REFRESH_THRESHOLD_SECONDS, refreshAuthToken } from '@/api/client';
import { isTokenExpired } from 'pocketbase';
import { isSessionExpired, notifySessionExpired } from '@/shared/auth/session';

export function useSessionKeepalive(): void {
  useEffect(() => {
    const checkSession = async () => {
      const token = pb.authStore.token;
      if (!token) return;
      if (isSessionExpired()) {
        notifySessionExpired();
        return;
      }
      if (isTokenExpired(token, AUTH_TOKEN_REFRESH_THRESHOLD_SECONDS)) {
        await refreshAuthToken();
      }
    };

    void checkSession();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkSession();
    };
    const onFocus = () => {
      void checkSession();
    };
    const onOnline = () => {
      void checkSession();
    };

    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    const intervalId = setInterval(checkSession, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      clearInterval(intervalId);
    };
  }, []);
}
