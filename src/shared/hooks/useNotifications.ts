import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClientResponseError } from 'pocketbase';
import { pb } from '@/api/client';
import { getNotificationsPage, getNotificationsByDate } from '@/api/collections';
import { useAuth } from '@/shared/context/AuthContext';
import type { INotification } from '@/shared/types';

// Backoff before each retry; a failing read gets MAX_ATTEMPTS tries in total.
const RETRY_DELAYS_MS: readonly number[] = [1000, 3000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/** A superseded request is not a user-facing failure — fail silently and keep the list. */
function isAbortError(err: unknown): boolean {
  if (err instanceof ClientResponseError) return err.isAbort;
  return err instanceof DOMException && err.name === 'AbortError';
}

/** A 401 already cleared the auth store and redirected to /login, so retrying is pointless. */
function isUnauthorized(err: unknown): boolean {
  return err instanceof ClientResponseError && err.status === 401;
}

function describeFailure(err: unknown): string {
  if (err instanceof ClientResponseError) return `Ошибка загрузки уведомлений (HTTP ${err.status})`;
  if (err instanceof Error) return err.message;
  return 'Не удалось загрузить уведомления';
}

export function useNotificationsByDate(date: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notificationsByDate', user?.id, date],
    queryFn: () => getNotificationsByDate(user!.id, date),
    enabled: !!user && !!date,
  });
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [newNotification, setNewNotification] = useState<INotification | null>(null);
  const loadedCountRef = useRef(0);
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);

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
      Promise.resolve().then(() =>
        apply(() => {
          setNotifications([]);
          setHasMore(false);
          setTotalItems(0);
          setNewNotification(null);
          setError(null);
          setIsLoading(false);
        }),
      );
      return;
    }

    loadedCountRef.current = 0;
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
        const res = await getNotificationsPage(user.id);
        apply(() => {
          loadedCountRef.current = res.items.length;
          setNotifications(res.items);
          setTotalItems(res.totalItems);
          setHasMore(res.items.length < res.totalItems);
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
  }, [user]);

  const hasUser = !!user;

  useEffect(() => {
    load();

    if (!hasUser) return;

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

  const loadMore = useCallback(() => {
    if (!user || isLoadingMore || !hasMore || notifications.length === 0) return;
    const last = notifications[notifications.length - 1];
    if (!last) return;
    setIsLoadingMore(true);
    getNotificationsPage(user.id, last.created)
      .then((res) => {
        loadedCountRef.current += res.items.length;
        setNotifications((prev) => {
          if (res.items.length === 0) return prev;
          const seen = new Set(prev.map((n) => n.id));
          return [...prev, ...res.items.filter((n) => !seen.has(n.id))];
        });
        setTotalItems(res.totalItems);
        setHasMore(loadedCountRef.current < res.totalItems);
      })
      .finally(() => {
        setIsLoadingMore(false);
      });
  }, [user, isLoadingMore, hasMore, notifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  useEffect(() => {
    if (!user) return;

    pb.collection('notifications').subscribe<INotification>('*', (e) => {
      if (e.action === 'create') {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === e.record.id)) return prev;
          loadedCountRef.current += 1;
          return [e.record, ...prev];
        });
        setNewNotification(e.record);
        setTimeout(() => setNewNotification(null), 3000);
      } else if (e.action === 'update') {
        setNotifications((prev) =>
          prev.map((n) => (n.id === e.record.id ? e.record : n)),
        );
      } else if (e.action === 'delete') {
        setNotifications((prev) => prev.filter((n) => n.id !== e.record.id));
      }
    });

    return () => {
      pb.collection('notifications').unsubscribe('*');
    };
  }, [user]);

  const markAsRead = useCallback((id: string) => {
    pb.collection('notifications')
      .update(id, { read: true })
      .then(() => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      });
  }, []);

  const markAllAsRead = useCallback(() => {
    if (unreadCount === 0) return;
    Promise.all(
      notifications
        .filter((n) => !n.read)
        .map((n) => pb.collection('notifications').update(n.id, { read: true })),
    ).then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    });
  }, [notifications, unreadCount]);

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