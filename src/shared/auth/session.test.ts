import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSessionExpired,
  getSessionStatus,
  onSessionExpired,
  notifySessionExpired,
  resumeSession,
  ensureSession,
  isSessionExpiredError,
  SessionExpiredError,
} from './session';

vi.mock('@/api/client', () => ({
  pb: {
    authStore: {
      get token() {
        return currentToken;
      },
    },
  },
}));

let currentToken = '';

function setToken(token: string | null) {
  currentToken = token ?? '';
}

describe('клиентская сессия (src/shared/auth/session.ts)', () => {
  beforeEach(() => {
    setToken('');
    resumeSession();
    vi.restoreAllMocks();
  });

  it('isSessionExpired() возвращает false когда токена нет', () => {
    setToken('');
    expect(isSessionExpired()).toBe(false);
  });

  it('isSessionExpired() возвращает true когда токен истёк', () => {
    const exp = Math.floor(Date.now() / 1000) - 3600; // истек час назад
    const payload = btoa(JSON.stringify({ exp }));
    setToken(`header.${payload}.signature`);
    expect(isSessionExpired()).toBe(true);
  });

  it('isSessionExpired() возвращает false когда токен валиден', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600; // истечёт через час
    const payload = btoa(JSON.stringify({ exp }));
    setToken(`header.${payload}.signature`);
    expect(isSessionExpired()).toBe(false);
  });

  it('getSessionStatus() возвращает anonymous для пустого токена', () => {
    setToken('');
    expect(getSessionStatus()).toBe('anonymous');
  });

  it('getSessionStatus() возвращает active для валидного токена', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp }));
    setToken(`header.${payload}.signature`);
    expect(getSessionStatus()).toBe('active');
  });

  it('getSessionStatus() возвращает expired для истёкшего токена', () => {
    const exp = Math.floor(Date.now() / 1000) - 3600;
    const payload = btoa(JSON.stringify({ exp }));
    setToken(`header.${payload}.signature`);
    expect(getSessionStatus()).toBe('expired');
  });

  it('onSessionExpired вызывает колбэк ровно один раз после notifySessionExpired', () => {
    const cb = vi.fn();
    const unsub = onSessionExpired(cb);
    notifySessionExpired();
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    notifySessionExpired();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('resumeSession() после notifySessionExpired позволяет повторно уведомить при новом истечении', () => {
    const exp = Math.floor(Date.now() / 1000) - 3600;
    const payload = btoa(JSON.stringify({ exp }));
    setToken(`header.${payload}.signature`);
    const cb = vi.fn();
    const unsub = onSessionExpired(cb);
    notifySessionExpired();
    notifySessionExpired();
    expect(cb).toHaveBeenCalledTimes(1);
    resumeSession();
    notifySessionExpired();
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
  });

  it('isSessionExpiredError возвращает true для SessionExpiredError', () => {
    expect(isSessionExpiredError(new SessionExpiredError())).toBe(true);
  });

  it('isSessionExpiredError возвращает false для обычной ошибки', () => {
    expect(isSessionExpiredError(new Error('ошибка'))).toBe(false);
  });

  it('ensureSession() возвращает true когда токен истёк', () => {
    const exp = Math.floor(Date.now() / 1000) - 3600;
    const payload = btoa(JSON.stringify({ exp }));
    setToken(`header.${payload}.signature`);
    expect(ensureSession()).toBe(true);
  });

  it('ensureSession() возвращает false когда токен валиден', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp }));
    setToken(`header.${payload}.signature`);
    expect(ensureSession()).toBe(false);
  });
});
