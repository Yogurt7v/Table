/** Основной хук уведомлений: загрузка, пагинация, re-check, realtime и отметки прочитанными. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getNotificationsPage,
  getUnreadNotificationsCount,
  NOTIFICATIONS_PAGE_SIZE,
} from '@/api/collections';
import { useAuth } from '@/shared/context/AuthContext';
import type { INotification } from '@/shared/types';
import { useNotificationReadActions } from './useNotificationReadActions';
import { useNotificationsSubscription } from './useNotificationsSubscription';
import {
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  describeFailure,
  isAbortError,
  isUnauthorized,
  mergePagedIn,
} from './useNotificationsHelpers';

/**
 * Загружает и поддерживает актуальным список уведомлений текущего пользователя:
 * первая страница с ретраями, догрузка, периодический re-check при возврате во вкладку,
 * realtime-обновления и отметка прочитанными.
 */
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Серверный unread-итог. `null` до первого успешного запроса счётчика: в памяти может
  // быть только одна страница из сотен, поэтому подсчёт по загруженным строкам неточен.
  const [unreadTotal, setUnreadTotal] = useState<number | null>(null);
  const [newNotification, setNewNotification] = useState<INotification | null>(null);
  const loadedCountRef = useRef(0);
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  /**
   * Актуальные строки в памяти, доступные колбэкам без зависимости от identity `notifications`:
   * re-check мерджится с ними, а переход в «прочитано» считается относительно них.
   *
   * Источник истины сам по себе — обновляется синхронно writers ниже, не зеркалится из state
   * post-factum: при батче «ответ записи + realtime-эхо той же записи» effect-миррор ещё держал
   * бы старые строки, и оба наблюдателя списали бы счётчик.
   */
  const notificationsRef = useRef<INotification[]>([]);

  /** Writer для уже вычисленного списка уведомлений. */
  const writeNotifications = useCallback((next: INotification[]) => {
    notificationsRef.current = next;
    setNotifications(next);
  }, []);

  /**
   * Writer для изменения, вычисленного от текущих строк в памяти. Ref обновляется до
   * state-setter, чтобы быть корректным для чтений в том же батче. Updater-функция в React
   * не передаётся (важно для корректного поведения side effects в StrictMode).
   */
  const amendNotifications = useCallback((change: (held: INotification[]) => INotification[]) => {
    const next = change(notificationsRef.current);
    notificationsRef.current = next;
    setNotifications(next);
  }, []);

  const load = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const seq = ++requestSeqRef.current;
    const apply = (updates: () => void) => {
      if (seq !== requestSeqRef.current) return;
      updates();
    };

    if (!user) {
      // Асинхронный сброс, чтобы не делать setState синхронно в теле эффекта/callback.
      Promise.resolve().then(() =>
        apply(() => {
          writeNotifications([]);
          setHasMore(false);
          setTotalItems(0);
          setUnreadTotal(null);
          setNewNotification(null);
          setError(null);
          setIsLoading(false);
        }),
      );
      return;
    }

    // Re-check не должен терять строки, догруженные через «Показать ещё»; свежая первая
    // страница мерджится с удерживаемыми строками, если уже загружено больше первой страницы.
    const keepPagedIn = loadedCountRef.current > NOTIFICATIONS_PAGE_SIZE;
    inFlightRef.current = true;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = null;
          resolve();
        }, ms);
      });

    const attempt = async (n: number): Promise<void> => {
      if (n > MAX_ATTEMPTS || seq !== requestSeqRef.current) return;
      try {
        const [res, total] = await Promise.all([
          getNotificationsPage(user.id),
          // Ошибка счётчика не должна валить список: деградируем до `null`, сохраняя последний
          // известный итог (или fallback на число загруженных строк в UI).
          getUnreadNotificationsCount(user.id).catch(() => null),
        ]);
        apply(() => {
          const merged = keepPagedIn
            ? mergePagedIn(res.items, notificationsRef.current)
            : res.items;
          loadedCountRef.current = merged.length;
          writeNotifications(merged);
          setTotalItems(res.totalItems);
          setHasMore(merged.length < res.totalItems);
          if (total !== null) setUnreadTotal(total);
          setError(null);
          setIsLoading(false);
        });
      } catch (err) {
        if (isAbortError(err)) return;
        if (n < MAX_ATTEMPTS && !isUnauthorized(err)) {
          await wait(RETRY_DELAYS_MS[n - 1] ?? 0);
          await attempt(n + 1);
          return;
        }
        apply(() => {
          setError(describeFailure(err));
          setIsLoading(false);
        });
      }
    };

    void attempt(1).finally(() => {
      if (seq === requestSeqRef.current) inFlightRef.current = false;
    });
  }, [user, writeNotifications]);

  const hasUser = !!user;

  useEffect(() => {
    load();

    if (!hasUser) return;

    // При возврате во вкладку/фокусе/онлайне перечитываем первую страницу, если нет активного запроса.
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      if (inFlightRef.current) return;
      load();
    };

    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    window.addEventListener('online', recheck);

    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
      window.removeEventListener('online', recheck);
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      requestSeqRef.current += 1;
      inFlightRef.current = false;
    };
  }, [load, hasUser]);

  /** Догружает следующую страницу уведомлений относительно последней загруженной записи. */
  const loadMore = useCallback(() => {
    if (!user || isLoadingMore || !hasMore || notifications.length === 0) return;
    const last = notifications[notifications.length - 1];
    if (!last) return;
    setIsLoadingMore(true);
    getNotificationsPage(user.id, last.created)
      .then((res) => {
        loadedCountRef.current += res.items.length;
        amendNotifications((prev) => {
          if (res.items.length === 0) return prev;
          const seen = new Set(prev.map((n) => n.id));
          return [...prev, ...res.items.filter((n) => !seen.has(n.id))];
        });
        setTotalItems(res.totalItems);
        setHasMore(loadedCountRef.current < res.totalItems);
      })
      .catch((err: unknown) => {
        // Пропала только следующая страница — текущие строки остаются, следующий re-check повторит.
        // Отменённый/устаревший запрос игнорируем.
        if (isAbortError(err)) return;
        setError(describeFailure(err));
      })
      .finally(() => {
        setIsLoadingMore(false);
      });
  }, [user, isLoadingMore, hasMore, notifications, amendNotifications]);

  // Счётчик непрочитанных в памяти — нижняя граница (используется, пока server total неизвестен).
  const loadedUnreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );
  const unreadCount = unreadTotal ?? loadedUnreadCount;

  const { settleAsRead, markAsRead, markAllAsRead } = useNotificationReadActions({
    user,
    unreadTotal,
    notificationsRef,
    amendNotifications,
    setUnreadTotal,
    setError,
  });

  useNotificationsSubscription({
    user,
    settleAsRead,
    amendNotifications,
    setNewNotification,
    loadedCountRef,
  });

  return {
    notifications,
    totalItems,
    isLoading,
    isLoadingMore,
    hasMore,
    unreadCount,
    newNotification,
    error,
    retryNow: load,
    loadMore,
    markAsRead,
    markAllAsRead,
  };
}
