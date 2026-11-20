/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/notifications`:
 * реализация живёт в домене `@/features/notifications/api`.
 */

export {
  NOTIFICATIONS_PAGE_SIZE,
  getNotificationsPage,
  getNotificationsByDate,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/features/notifications/api/notifications';
