/** Внутренние помощники API документов: экранирование фильтров и текущий актор. */

import { pb } from '../client.ts';
import { getLastKnownUser } from '@/shared/auth/last-known-user';

/** Экранирует значение для строкового операнда фильтра PocketBase. */
export function qTag(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Идентификатор текущего пользователя-актора (authStore или last-known). */
export function currentActorId(): string {
  return pb.authStore.model?.id ?? getLastKnownUser()?.id ?? '';
}

/** Отображаемое имя текущего пользователя-актора. */
export function currentActorName(): string {
  const model = pb.authStore.model ?? getLastKnownUser();
  return model?.name || model?.email || '';
}
