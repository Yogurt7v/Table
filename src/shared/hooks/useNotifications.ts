import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/api/client';
import { getNotifications } from '@/api/collections';
import { useAuth } from '@/shared/context/AuthContext';
import type { INotification } from '@/shared/types';

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newNotification, setNewNotification] = useState<INotification | null>(null);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => getNotifications(user!.id),
    enabled: !!user,
  });

  const items = notificationsQuery.data?.items ?? [];
  const unreadCount = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) return;

    pb.collection('notifications').subscribe<INotification>('*', (e) => {
      qc.invalidateQueries({ queryKey: ['notifications', user.id] });
      if (e.action === 'create') {
        setNewNotification(e.record);
        setTimeout(() => setNewNotification(null), 3000);
      }
    });

    return () => {
      pb.collection('notifications').unsubscribe('*');
    };
  }, [user, qc]);

  const markAsRead = useCallback((id: string) => {
    pb.collection('notifications').update(id, { read: true }).then(() => {
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
    });
  }, [user, qc]);

  const markAllAsRead = useCallback(() => {
    if (unreadCount === 0) return;
    Promise.all(
      items.filter((n) => !n.read).map((n) =>
        pb.collection('notifications').update(n.id, { read: true }),
      ),
    ).then(() => {
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
    });
  }, [items, unreadCount, user, qc]);

  return {
    notifications: items,
    totalItems: notificationsQuery.data?.totalItems ?? 0,
    isLoading: notificationsQuery.isLoading,
    unreadCount,
    newNotification,
    markAsRead,
    markAllAsRead,
  };
}
