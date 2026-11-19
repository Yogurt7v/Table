import { ActionIcon, Badge } from '@mantine/core';
import { IconBell, IconBellFilled } from '@tabler/icons-react';
import { NotificationsBellDrawer } from './components/notifications-bell/NotificationsBellDrawer';
import { useNotificationsBell } from './components/notifications-bell/useNotificationsBell';

/**
 * Колокольчик уведомлений в шапке: значок с количеством непрочитанных
 * и выдвижная панель (`NotificationsBellDrawer`) со списком и календарём.
 * Логика загрузки, навигации и выбора дня — в `useNotificationsBell`.
 */
export function NotificationsBell() {
  const bell = useNotificationsBell();
  const { open, unreadCount } = bell;

  // Значок в шапке: иконка меняется при наличии непрочитанных, бейдж — их число.
  return (
    <>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        aria-label="Уведомления"
        onClick={open}
        pos="relative"
      >
        {unreadCount > 0 ? <IconBellFilled size={22} /> : <IconBell size={22} />}
        {unreadCount > 0 && (
          <Badge
            size="xs"
            circle
            color="red"
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 24,
              height: 18,
              padding: 0,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </ActionIcon>

      <NotificationsBellDrawer model={bell} />
    </>
  );
}
