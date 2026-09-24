import type { E2EUserMap } from './types';

export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? '12345678';

export const E2E_USERS: E2EUserMap = {
  admin: { login: 'admin', password: E2E_PASSWORD },
  moderator: { login: 'moderator', password: E2E_PASSWORD },
  user: { login: 'user', password: E2E_PASSWORD },
  boss: { login: 'Boss', password: E2E_PASSWORD },
  guest: { login: 'Sklad1', password: E2E_PASSWORD },
};

export const ORGS = {
  lenmetrostroy: { id: 'yvyg08lk9b61me0', name: 'Ленметрострой' },
} as const;

export type OrgKey = keyof typeof ORGS;

/** Служебный уникальный маркер сценария. */
export function uniqueMarker(p: string): string {
  return `${p}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}
