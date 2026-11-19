/**
 * Публичный barrel хуков уведомлений.
 * Реализация разнесена по модулям в `./use-notifications/*`, а этот путь сохраняет
 * совместимость импортов `@/shared/hooks/useNotifications`.
 */

export { useNotificationsByDate } from './use-notifications/useNotificationsByDate';
export { useNotifications } from './use-notifications/useNotifications';
