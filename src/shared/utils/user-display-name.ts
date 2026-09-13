import type { IUser } from '@/shared/types';

export function getUserDisplayName(user: IUser | undefined): string {
  if (!user) return '—';
  return user.name || user.login || '—';
}