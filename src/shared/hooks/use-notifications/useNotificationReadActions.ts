/** Действия отметки уведомлений прочитанными и учёт непрочитанного счётчика. */

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { pb } from '@/api/client';
import { markAllNotificationsAsRead } from '@/api/collections';
import type { IUser, INotification } from '@/shared/types';
import { describeWriteFailure, isAbortError } from './useNotificationsHelpers';

interface UseNotificationReadActionsArgs {
  user: IUser | null;
  unreadTotal: number | null;
  notificationsRef: MutableRefObject<INotification[]>;
  amendNotifications: (change: (held: INotification[]) => INotification[]) => void;
  setUnreadTotal: Dispatch<SetStateAction<number | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

/** Возвращает обработчики отметки уведомлений прочитанными с корректным учётом badge-счётчика. */
export function useNotificationReadActions({
  user,
  unreadTotal,
  notificationsRef,
  amendNotifications,
  setUnreadTotal,
  setError,
}: UseNotificationReadActionsArgs) {
  /**
   * Списывает с server-unread счётчика записи, ставшие прочитанными.
   * Ответ записи и realtime-эхо одного и того же изменения могут прийти оба, поэтому
   * списание выполняется не более одного раза на запись: кто первым увидел переход при
   * ещё непрочитанной строке в ref — тот и списывает.
   */
  const settleAsRead = useCallback(
    (ids: readonly string[]) => {
      const justRead = new Set(ids);
      const charged = notificationsRef.current.filter((n) => !n.read && justRead.has(n.id)).length;
      if (charged === 0) return;
      setUnreadTotal((prev) => (prev === null ? prev : Math.max(0, prev - charged)));
    },
    [notificationsRef, setUnreadTotal],
  );

  /** Отмечает одно уведомление прочитанным на сервере и локально. */
  const markAsRead = useCallback(
    (id: string) => {
      pb.collection('notifications')
        .update(id, { read: true })
        .then(() => {
          // Только внутри `.then`: server total меняется ровно когда запись реально помечена.
          // `settleAsRead` списывает только всё ещё непрочитанные строки, поэтому realtime-эхо
          // той же записи не спишет повторно.
          settleAsRead([id]);
          amendNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        })
        .catch((err: unknown) => {
          // Запись не применена: строка и badge остаются прежними, следующий re-check сверит состояние.
          // Отменённый (устаревший) запрос игнорируем — его дубль выполнил работу.
          if (isAbortError(err)) return;
          setError(describeWriteFailure(err));
        });
    },
    [settleAsRead, amendNotifications, setError],
  );

  /** Отмечает все уведомления пользователя прочитанными одним серверным запросом. */
  const markAllAsRead = useCallback(() => {
    // Клик с нулём непрочитанных отсекается по обоим сигналам: `pending` учитывает строки
    // в памяти (включая свежие realtime-создания), `unreadTotal` — серверный итог.
    // `null` итога не блокирует клик, если `pending` непуст.
    const pending = notificationsRef.current.filter((n) => !n.read);
    if (!user || (pending.length === 0 && (unreadTotal === null || unreadTotal === 0))) return;

    markAllNotificationsAsRead(user.id)
      .then(() => {
        // Сервер отметил все непрочитанные строки пользователя (включая не подгруженные),
        // поэтому итог выставляется в 0. Строки в ref уже станут прочитанными, так что
        // realtime-эхо/повторные наблюдатели не найдут переходов для списания.
        setUnreadTotal(0);
        amendNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
      })
      .catch((err: unknown) => {
        // Отметка не состоялась: строки и badge остаются прежними; локальные строки не трогаем.
        if (isAbortError(err)) return;
        setError(describeWriteFailure(err));
      });
  }, [user, unreadTotal, amendNotifications, notificationsRef, setUnreadTotal, setError]);

  return { settleAsRead, markAsRead, markAllAsRead };
}
