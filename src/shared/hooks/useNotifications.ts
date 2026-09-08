import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pb } from '@/api/client';
import { getNotificationsPage, getNotificationsByDate } from '@/api/collections';
import { useAuth } from '@/shared/context/AuthContext';
import type { INotification } from '@/shared/types';

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
  const [newNotification, setNewNotification] = useState<INotification | null>(null);
  const loadedCountRef = useRef(0);
  const requestSeqRef = useRef(0);

  useEffect(() => {
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
          setIsLoading(false);
        }),
      );
      return;
    }

    loadedCountRef.current = 0;
    getNotificationsPage(user.id)
      .then((res) =>
        apply(() => {
          loadedCountRef.current = res.items.length;
          setNotifications(res.items);
          setTotalItems(res.totalItems);
          setHasMore(res.items.length < res.totalItems);
          setIsLoading(false);
        }),
      )
      .catch(() =>
        apply(() => {
          setNotifications([]);
          setHasMore(false);
          setIsLoading(false);
        }),
      );
  }, [user]);

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
    loadMore,
    markAsRead,
    markAllAsRead,
  };
}