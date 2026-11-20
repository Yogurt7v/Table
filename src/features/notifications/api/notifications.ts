/** Уведомления пользователя: чтение, счётчики непрочитанных и отметка прочтения. */

import { pb } from '@/api/client';
import type { INotification } from '@/shared/types';

/** Размер страницы уведомлений по умолчанию. */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/** Возвращает страницу уведомлений пользователя (постранично назад по времени). */
export function getNotificationsPage(userId: string, beforeCreated?: string) {
  const filter = beforeCreated
    ? `user_id = "${userId}" && created < "${beforeCreated}"`
    : `user_id = "${userId}"`;
  return pb.collection('notifications').getList<INotification>(1, NOTIFICATIONS_PAGE_SIZE, {
    filter,
    sort: '-created',
    requestKey: null,
  });
}

/** Возвращает все уведомления пользователя за указанную дату. */
export function getNotificationsByDate(userId: string, date: string) {
  return pb.collection('notifications').getFullList<INotification>({
    filter: `user_id = "${userId}" && created >= "${date} 00:00:00" && created <= "${date} 23:59:59"`,
    sort: '-created',
    requestKey: null,
  });
}

/** Возвращает количество непрочитанных уведомлений пользователя. */
export function getUnreadNotificationsCount(userId: string) {
  return pb
    .collection('notifications')
    .getList<INotification>(1, 1, {
      filter: `user_id = "${userId}" && read = false`,
      fields: 'id',
      requestKey: null,
    })
    .then((res) => res.totalItems);
}

/** Отмечает уведомление как прочитанное. */
export function markNotificationAsRead(id: string) {
  return pb.collection('notifications').update<INotification>(id, { read: true });
}

/**
 * Отметить ВСЕ непрочитанные уведомления пользователя прочитанными одним запросом.
 *
 * Вызывает кастомный маршрут из `pb_hooks/notifications.pb.js` через `pb.send`:
 * бейдж рисуется по количеству непрочитанных строк пользователя на сервере, которое не
 * ограничено загруженной страницей, поэтому отметка «все» обязана покрывать весь список.
 * `userId` уходит в тело запроса в информационных целях — по контракту маршрута фильтр
 * строится из аутентификации (`e.auth.id`), а не из присланного с клиента идентификатора.
 */
export function markAllNotificationsAsRead(userId: string) {
  return pb.send<{ updated: number }>('/api/collections/notifications/mark-all-read', {
    method: 'POST',
    body: { userId },
  });
}
