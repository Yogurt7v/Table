import { pb } from '@/api/client';
import { isTokenExpired } from 'pocketbase';

export type SessionStatus = 'anonymous' | 'active' | 'expired';

const SESSION_EXPIRY_LEEWAY_SECONDS = 30;

const sessionExpiredListeners: Array<() => void> = [];
let sessionExpiredNotified = false;

export function isSessionExpired(leewaySeconds = SESSION_EXPIRY_LEEWAY_SECONDS): boolean {
  const token = pb.authStore.token;
  if (!token) return false;
  return isTokenExpired(token, leewaySeconds);
}

export function getSessionStatus(leewaySeconds = SESSION_EXPIRY_LEEWAY_SECONDS): SessionStatus {
  const token = pb.authStore.token;
  if (!token) return 'anonymous';
  return isTokenExpired(token, leewaySeconds) ? 'expired' : 'active';
}

export function onSessionExpired(callback: () => void): () => void {
  sessionExpiredListeners.push(callback);
  return () => {
    const index = sessionExpiredListeners.indexOf(callback);
    if (index !== -1) sessionExpiredListeners.splice(index, 1);
  };
}

export function markSessionExpiredNotified(): void {
  sessionExpiredNotified = true;
}

export function hasSessionExpiredNotification(): boolean {
  return sessionExpiredNotified;
}

export function notifySessionExpired(): void {
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  for (const callback of sessionExpiredListeners) callback();
}

export function resumeSession(): void {
  sessionExpiredNotified = false;
}

export function ensureSession(): boolean {
  if (isSessionExpired()) {
    notifySessionExpired();
    return true;
  }
  return false;
}

export function isSessionExpiredError(error: unknown): boolean {
  return error instanceof SessionExpiredError;
}

export class SessionExpiredError extends Error {
  silent = true;

  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}
