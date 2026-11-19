/** Внутренние помощники API коллекций: определение текущего актора (автор/пользователь). */

import { pb } from '../client.ts';
import { getLastKnownUser } from '@/shared/auth/last-known-user';

/**
 * Отображаемое имя текущего актора для текстовых полей истории.
 * При просроченном токене authStore может быть очищен раньше редиректа —
 * используется last-known-user как запасной источник.
 */
export function getCurrentAuthor(): string {
  const model = pb.authStore.model ?? getLastKnownUser();
  return model?.name || model?.email || 'unknown';
}

/**
 * id актора для relation-полей (`payment_marks.created_by`, `deleted_by`).
 *
 * Тот же фолбэк, что у `getCurrentAuthor`: при просроченном токене
 * `afterSend` чистит `authStore` мгновенно, а редирект на /login асинхронный.
 * В это окно прямой `pb.authStore.model?.id` даёт `undefined`, и в запись
 * уезжает пустой автор. Реестр last-known-user переживает чистку store.
 */
export function getCurrentActorId(): string {
  return pb.authStore.model?.id ?? getLastKnownUser()?.id ?? '';
}
