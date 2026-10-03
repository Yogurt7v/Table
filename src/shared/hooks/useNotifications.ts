import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClientResponseError } from 'pocketbase';
import type { UnsubscribeFunc } from 'pocketbase';
import { pb } from '@/api/client';
import {
  getNotificationsPage,
  getNotificationsByDate,
  getUnreadNotificationsCount,
  NOTIFICATIONS_PAGE_SIZE,
} from '@/api/collections';
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

/** A write that failed leaves the row unread and the badge where it was — say so. */
function describeWriteFailure(err: unknown): string {
  if (err instanceof ClientResponseError) {
    return `Не удалось отметить как прочитанное (HTTP ${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return 'Не удалось отметить уведомление как прочитанное';
}

/**
 * A re-check must not take back rows the user paged in with «Показать ещё». The fresh first
 * page wins for every record it repeats; the rows it does not mention are kept behind them,
 * re-sorted `created`-descending — the order the server sends. `fresh` comes back untouched
 * when there is nothing to keep, so the single-page case stays exactly what it always was.
 *
 * Accepted trade-off, do not "fix" without a tombstone: a kept row the server has since
 * deleted comes back with the merge. The re-check cannot tell "gone" from "not on page 1" —
 * only the realtime `delete` can, and a tab that missed it has no other signal. Measured:
 * 40 rows held against `totalItems` 39. A later `delete` event or a fresh mount clears it.
 * Dropping rows the merge cannot vouch for would defeat the only thing it exists to do.
 */
function mergePagedIn(fresh: INotification[], held: INotification[]): INotification[] {
  const freshIds = new Set(fresh.map((n) => n.id));
  const kept = held.filter((n) => !freshIds.has(n.id));
  if (kept.length === 0) return fresh;
  const byCreatedDesc = (a: INotification, b: INotification) =>
    a.created < b.created ? 1 : a.created > b.created ? -1 : 0;
  return [...fresh, ...kept].sort(byCreatedDesc);
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
  // The server's own unread total. `null` until the first count request succeeds — the
  // list may hold 20 rows out of hundreds, so counting loaded rows is not the truth.
  const [unreadTotal, setUnreadTotal] = useState<number | null>(null);
  const [newNotification, setNewNotification] = useState<INotification | null>(null);
  const loadedCountRef = useRef(0);
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const unsubscribeRef = useRef<UnsubscribeFunc | null>(null);
  /**
   * The rows in memory, readable from callbacks that must not depend on `notifications`
   * identity: a re-check merges against them, and a read-transition is counted against them.
   *
   * Authoritative on its own — written synchronously by the two writers below, never mirrored
   * out of state after the fact. An effect-synced mirror is still showing the pre-commit rows
   * when the write response and the realtime echo of that same write both land in one batch
   * (React commits in a microtask, passive effects in a macrotask), so both would charge.
   */
  const notificationsRef = useRef<INotification[]>([]);

  /** The writer for rows whose contents are already known. */
  const writeNotifications = useCallback((next: INotification[]) => {
    notificationsRef.current = next;
    setNotifications(next);
  }, []);

  /**
   * The writer for a change computed from the rows in memory. Eager, from the ref, and the
   * ref is assigned before the state setter so it is already correct for anything reading it
   * later in this same batch. No updater function reaches React, so StrictMode cannot call
   * one twice and re-run a side effect inside it.
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

    // A re-check must not take back what the user paged in with «Показать ещё», so the fresh
    // page merges into the held rows instead of replacing them — but only once something
    // beyond the first page has actually been loaded.
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
          // A failing count must never fail the list, so it degrades to `null` and the
          // last known total (or the loaded-page count) keeps rendering the bell.
          getUnreadNotificationsCount(user.id).catch(() => null),
        ]);
        apply(() => {
          const merged = keepPagedIn ? mergePagedIn(res.items, notificationsRef.current) : res.items;
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
        amendNotifications((prev) => {
          if (res.items.length === 0) return prev;
          const seen = new Set(prev.map((n) => n.id));
          return [...prev, ...res.items.filter((n) => !seen.has(n.id))];
        });
        setTotalItems(res.totalItems);
        setHasMore(loadedCountRef.current < res.totalItems);
      })
      .catch((err: unknown) => {
        // Only the next page is missing — the rows on screen stay, and the next re-check
        // retries. A superseded read is dropped: its twin answered the same page.
        if (isAbortError(err)) return;
        setError(describeFailure(err));
      })
      .finally(() => {
        setIsLoadingMore(false);
      });
  }, [user, isLoadingMore, hasMore, notifications, amendNotifications]);

  // `loadedUnreadCount` counts only the rows in memory (one page of
  // NOTIFICATIONS_PAGE_SIZE plus whatever was paged in) and is therefore a lower bound;
  // it is used only while the server total is unknown, so the bell still renders a number.
  const loadedUnreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );
  const unreadCount = unreadTotal ?? loadedUnreadCount;

  /**
   * Charges the unread total for rows that just became read. A write response and the
   * realtime echo of that same write both arrive, and both bells see the echo, so the count
   * may move exactly once per record: whoever observes the transition while the row is still
   * held as unread pays for it, and the later observer finds nothing left to charge.
   */
  const settleAsRead = useCallback((ids: readonly string[]) => {
    const justRead = new Set(ids);
    const charged = notificationsRef.current.filter((n) => !n.read && justRead.has(n.id)).length;
    if (charged === 0) return;
    setUnreadTotal((prev) => (prev === null ? prev : Math.max(0, prev - charged)));
  }, []);

  useEffect(() => {
    if (!user) return;

    // subscribe() is async, so teardown can beat it; `unmounted` lets a late resolution release itself.
    let unmounted = false;

    const release = (unsubscribe: UnsubscribeFunc) => {
      void unsubscribe().catch((err: unknown) => {
        console.error('Не удалось отписаться от уведомлений в реальном времени', err);
      });
    };

    const connect = async () => {
      try {
        const unsubscribe = await pb
          .collection('notifications')
          .subscribe<INotification>('*', (e) => {
            if (e.action === 'create') {
              amendNotifications((prev) => {
                if (prev.some((n) => n.id === e.record.id)) return prev;
                loadedCountRef.current += 1;
                return [e.record, ...prev];
              });
              setNewNotification(e.record);
              setTimeout(() => setNewNotification(null), 3000);
            } else if (e.action === 'update') {
              // Both bells get this event, so the badge has to converge here as well — else
              // the bell that did not get the click keeps its total until its next re-check.
              // A record that arrives still unread is not a transition and costs nothing.
              // Charging first is load-bearing: the amendment below marks the row read in the
              // ref, so a second observer in this batch finds no transition left to charge.
              if (e.record.read) settleAsRead([e.record.id]);
              amendNotifications((prev) => prev.map((n) => (n.id === e.record.id ? e.record : n)));
            } else if (e.action === 'delete') {
              amendNotifications((prev) => prev.filter((n) => n.id !== e.record.id));
            }
          });

        if (unmounted) {
          release(unsubscribe);
          return;
        }
        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        console.error('Не удалось подключиться к уведомлениям в реальном времени', err);
      }
    };

    void connect();

    return () => {
      unmounted = true;
      const active = unsubscribeRef.current;
      unsubscribeRef.current = null;
      if (active) release(active);
    };
  }, [user, settleAsRead, amendNotifications]);

  const markAsRead = useCallback(
    (id: string) => {
      pb.collection('notifications')
        .update(id, { read: true })
        .then(() => {
          // Only inside the existing `.then`: the server total is a count, so it must move
          // exactly when the write it mirrors lands. `settleAsRead` charges only what is
          // still held as unread, so the realtime echo of this same write cannot pay twice.
          settleAsRead([id]);
          amendNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        })
        .catch((err: unknown) => {
          // The write never landed: the row stays unread, the badge stays put, and the list
          // is left alone so the next re-check reconciles it. A superseded write is dropped —
          // the SDK cancels duplicate PATCHes to one record, and its twin did the work.
          if (isAbortError(err)) return;
          setError(describeWriteFailure(err));
        });
    },
    [settleAsRead, amendNotifications],
  );

  const markAllAsRead = useCallback(() => {
    // Guard on the loaded rows, not on `unreadCount`: this button (owner decision D-2)
    // only ever marks the notifications it holds, so "is there anything left to mark"
    // is a property of `notifications` alone — and it stays correct when the server
    // total is null (never fetched / count request failed) or larger than the page.
    const pending = notifications.filter((n) => !n.read);
    if (pending.length === 0) return;
    Promise.all(
      pending.map((n) => pb.collection('notifications').update(n.id, { read: true })),
    )
      .then(() => {
        // Subtract exactly what was marked — never zero the total: unread rows outside this
        // page are still unread until they are loaded and marked. `settleAsRead` counts what
        // is still held as unread, so the realtime echoes of these writes cannot pay twice.
        settleAsRead(pending.map((n) => n.id));
        amendNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      })
      .catch((err: unknown) => {
        // Some of the writes may have landed and some not; the rows on screen keep their
        // current state either way and the next re-check reconciles against the server.
        if (isAbortError(err)) return;
        setError(describeWriteFailure(err));
      });
  }, [notifications, settleAsRead, amendNotifications]);

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