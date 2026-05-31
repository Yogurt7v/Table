import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Stack,
  Group,
  Text,
  Box,
  Loader,
  Center,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { IconBell, IconBellFilled } from '@tabler/icons-react';
import { useNotifications } from '@/shared/hooks/useNotifications';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsBell() {
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();
  const {
    notifications: items,
    isLoading,
    unreadCount,
    newNotification,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const unreadItems = items.filter((n) => !n.read);

  if (newNotification && !opened) {
    notifications.show({
      title: newNotification.actor_name,
      message: newNotification.event,
      color: 'blue',
      onClick: () => setOpened(true),
    });
  }

  return (
    <>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        onClick={() => setOpened(true)}
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
              minWidth: 18,
              height: 18,
              padding: 0,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </ActionIcon>

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title="Уведомления"
        position="right"
        size="md"
      >
        {unreadCount > 0 && !isLoading && (
          <Button
            variant="light"
            size="xs"
            fullWidth
            mb="sm"
            onClick={markAllAsRead}
          >
            Прочитать все ({unreadCount})
          </Button>
        )}
        {isLoading ? (
          <Center h={200}>
            <Loader />
          </Center>
        ) : unreadItems.length === 0 ? (
          <Center h={200}>
            <Text c="dimmed">Нет уведомлений</Text>
          </Center>
        ) : (
          <Stack gap="xs">
            {unreadItems.map((n) => (
              <Box
                key={n.id}
                p="sm"
                style={(theme) => ({
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.blue[0],
                  cursor: 'pointer',
                  border: `1px solid ${theme.colors.blue[2]}`,
                })}
                onClick={() => {
                  markAsRead(n.id);
                  if (n.invoice_id) {
                    setOpened(false);
                    navigate('/');
                  }
                }}
              >
                <Group justify="space-between" mb={4}>
                  <Text size="sm" fw={500}>
                    {n.actor_name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatDate(n.created)}
                  </Text>
                </Group>
                <Text size="sm">{n.event}</Text>
              </Box>
            ))}
          </Stack>
        )}
      </Drawer>
    </>
  );
}
