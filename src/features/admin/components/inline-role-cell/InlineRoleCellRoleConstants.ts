import type { IOrganizationUser } from '@/shared/types';

type Role = IOrganizationUser['role'];

export const ROLE_COLORS: Record<Role, string> = {
  admin: 'red',
  moderator: 'blue',
  user: 'green',
  boss: 'yellow',
  guest: 'gray',
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Администратор',
  moderator: 'Модератор',
  user: 'Пользователь',
  boss: 'Босс',
  guest: 'Гость',
};

export const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

export function roleInputStyles(role: Role) {
  return { input: { backgroundColor: `var(--mantine-color-${ROLE_COLORS[role]}-0)` } };
}
