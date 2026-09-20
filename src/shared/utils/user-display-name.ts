import type { IUser } from '@/shared/types';

export function getUserDisplayName(user: IUser | undefined): string {
  if (!user) return '—';
  return user.name || user.login || '—';
}

/**
 * Отображаемое имя инициатора счёта.
 *
 * `createdByName` — снимок имени в самом счёте. Он приоритетнее, потому что
 * `created_by` не резолвится, если счёт создан суперюзером (его нет в `users`)
 * или если пользователя позже удалили.
 */
export function getInitiatorDisplayName(
  createdBy: string | undefined,
  createdByName: string | undefined,
  userMap: Map<string, IUser>,
): string {
  if (createdByName) return createdByName;
  return getUserDisplayName(createdBy ? userMap.get(createdBy) : undefined);
}