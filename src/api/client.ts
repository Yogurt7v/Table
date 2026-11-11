import PocketBase, { isTokenExpired } from 'pocketbase';
import {
  ensureSession,
  isSessionExpired,
  notifySessionExpired,
  SessionExpiredError,
} from '@/shared/auth/session';

const API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8090' : window.location.origin;

export const pb = new PocketBase(API_URL);

export const AUTH_TOKEN_REFRESH_THRESHOLD_SECONDS = 21600;

let refreshPromise: Promise<boolean> | null = null;

export async function refreshAuthToken(): Promise<boolean> {
  const token = pb.authStore.token;
  if (!token) return false;
  if (isTokenExpired(token)) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        await pb.collection('users').authRefresh({ autoRefresh: true });
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

const previousBeforeSend = pb.beforeSend;

pb.beforeSend = async (url, options) => {
  if (options.query?.autoRefresh) {
    return previousBeforeSend ? previousBeforeSend(url, options) : { url, options };
  }

  const isAuthRequest = url.includes('/api/collections/users/auth-with-password');
  if (!isAuthRequest && ensureSession()) {
    throw new SessionExpiredError();
  }

  const staleToken = pb.authStore.token;
  if (pb.authStore.isValid && isTokenExpired(staleToken, AUTH_TOKEN_REFRESH_THRESHOLD_SECONDS)) {
    const refreshed = await refreshAuthToken();
    if (!refreshed) {
      console.warn('Не удалось заранее продлить токен, запрос уходит со старым');
    }
  }

  const freshToken = pb.authStore.token;
  const headers = options.headers ?? {};
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'authorization' && value === staleToken && freshToken) {
      headers[name] = freshToken;
      break;
    }
  }
  options.headers = headers;

  return previousBeforeSend ? previousBeforeSend(url, options) : { url, options };
};

pb.autoCancellation(false);

const previousAfterSend = pb.afterSend;

pb.afterSend = async (response, data) => {
  if (response.status === 401 && pb.authStore.token) {
    if (isSessionExpired(0)) {
      notifySessionExpired();
      return previousAfterSend ? previousAfterSend(response, data) : data;
    }

    const refreshed = await refreshAuthToken();
    if (!refreshed) {
      notifySessionExpired();
      if (!pb.authStore.token && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
  }
  return previousAfterSend ? previousAfterSend(response, data) : data;
};
