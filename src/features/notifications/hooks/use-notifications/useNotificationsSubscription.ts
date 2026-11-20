/** Подписка на realtime-обновления уведомлений PocketBase. */

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { UnsubscribeFunc } from 'pocketbase';
import { pb } from '@/api/client';
import type { IUser, INotification } from '@/shared/types';

interface UseNotificationsSubscriptionArgs {
  user: IUser | null;
  settleAsRead: (ids: readonly string[]) => void;
  amendNotifications: (change: (held: INotification[]) => INotification[]) => void;
  setNewNotification: Dispatch<SetStateAction<INotification | null>>;
  loadedCountRef: MutableRefObject<number>;
}

/** Подключает realtime-подписку на коллекцию уведомлений и синхронизирует локальное состояние. */
export function useNotificationsSubscription({
  user,
  settleAsRead,
  amendNotifications,
  setNewNotification,
  loadedCountRef,
}: UseNotificationsSubscriptionArgs) {
  useEffect(() => {
    if (!user) return;

    // subscribe() асинхронен: размонтирование может произойти раньше резолва,
    // поэтому `unmounted` позволяет корректно освободить поздний unsubscribe.
    let unmounted = false;
    let activeUnsub: UnsubscribeFunc | null = null;

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
              // Кратковременный маркер «новое уведомление» для UI.
              setTimeout(() => setNewNotification(null), 3000);
            } else if (e.action === 'update') {
              // Событие получают все подписчики; badge должен сходиться и здесь.
              // Сначала списываем переход, затем помечаем строку прочитанной в ref/state,
              // чтобы второй наблюдатель в том же батче не списал повторно.
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
        activeUnsub = unsubscribe;
      } catch (err) {
        console.error('Не удалось подключиться к уведомлениям в реальном времени', err);
      }
    };

    void connect();

    return () => {
      unmounted = true;
      if (activeUnsub) release(activeUnsub);
    };
  }, [user, settleAsRead, amendNotifications, setNewNotification, loadedCountRef]);
}
