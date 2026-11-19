/** Вспомогательные константы и функции для хуков уведомлений: повторы, классификация ошибок и слияние страниц. */

import { ClientResponseError } from 'pocketbase';
import type { INotification } from '@/shared/types';

// Backoff перед каждой повторной попыткой; неудачное чтение получает MAX_ATTEMPTS попыток всего.
export const RETRY_DELAYS_MS: readonly number[] = [1000, 3000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/** Отменённый/устаревший запрос — не ошибка для пользователя, список оставляем как есть. */
export function isAbortError(err: unknown): boolean {
  if (err instanceof ClientResponseError) return err.isAbort;
  return err instanceof DOMException && err.name === 'AbortError';
}

/** 401 уже очистил auth-store и перенаправил на /login, повторять запрос бессмысленно. */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof ClientResponseError && err.status === 401;
}

/** Описание ошибки чтения уведомлений для UI. */
export function describeFailure(err: unknown): string {
  if (err instanceof ClientResponseError) return `Ошибка загрузки уведомлений (HTTP ${err.status})`;
  if (err instanceof Error) return err.message;
  return 'Не удалось загрузить уведомления';
}

/** Описание ошибки записи (отметки прочитанным) для UI. */
export function describeWriteFailure(err: unknown): string {
  if (err instanceof ClientResponseError) {
    return `Не удалось отметить как прочитанное (HTTP ${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return 'Не удалось отметить уведомление как прочитанное';
}

/**
 * Слияние свежей первой страницы с уже подгруженными строками («Показать ещё»).
 * Строки из `fresh` имеют приоритет при совпадении id; строки, которых нет в `fresh`,
 * сохраняются после них и пересортировываются по `created` по убыванию.
 *
 * Компромисс: строка, удалённая на сервере после подгрузки, может вернуться при merge,
 * если re-check не видит её на первой странице (нет tombstone). Позже событие realtime
 * `delete` или новый mount очистит её.
 */
export function mergePagedIn(fresh: INotification[], held: INotification[]): INotification[] {
  const freshIds = new Set(fresh.map((n) => n.id));
  const kept = held.filter((n) => !freshIds.has(n.id));
  if (kept.length === 0) return fresh;
  const byCreatedDesc = (a: INotification, b: INotification) =>
    a.created < b.created ? 1 : a.created > b.created ? -1 : 0;
  return [...fresh, ...kept].sort(byCreatedDesc);
}
