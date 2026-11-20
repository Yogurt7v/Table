import { useState } from 'react';
import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import type { INotification } from '@/shared/types';
import { formatDate } from './notifications-bell-utils';

interface NotificationBlockProps {
  notification: INotification;
  onNavigate: (n: INotification) => void;
  onMarkRead: (id: string) => void;
}

/**
 * Карточка одного уведомления: клик отмечает прочитанным и ведёт к счёту/документу,
 * а подробности (если есть) раскрываются кнопкой «Подробнее».
 */
export function NotificationBlock({
  notification,
  onNavigate,
  onMarkRead,
}: NotificationBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isRead = notification.read;
  const hasExtra = notification.message && notification.message !== notification.event;

  // Клик по карточке: сначала отметить прочитанным, затем перейти к объекту,
  // если уведомление привязано к счёту или документу.
  const handleClick = () => {
    if (!isRead) onMarkRead(notification.id);
    if (notification.invoice_id) {
      onNavigate(notification);
    } else if (notification.document_id) {
      onNavigate(notification);
    }
  };

  return (
    <Box
      w="100%"
      onClick={handleClick}
      style={{
        display: 'block',
        width: '100%',
        borderRadius: 'var(--mantine-radius-sm)',
        border: `1px solid ${
          isRead ? 'var(--mantine-color-gray-3)' : 'var(--mantine-color-blue-3)'
        }`,
        backgroundColor: isRead ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-blue-0)',
        padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
        cursor: notification.invoice_id || notification.document_id ? 'pointer' : 'default',
      }}
    >
      {/* Шапка: автор, индикатор непрочитанного, время и раскрытие деталей */}
      <Group justify="space-between" mb={2}>
        <Group gap={6}>
          {!isRead && <Box w={7} h={7} bg="blue" style={{ borderRadius: '50%' }} />}
          <Text size="sm" fw={600}>
            {notification.actor_name}
          </Text>
        </Group>
        <Group gap={6}>
          <Text size="xs" c="dimmed">
            {formatDate(notification.created)}
          </Text>
          {hasExtra && (
            <UnstyledButton
              size="xs"
              c="dimmed"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((x) => !x);
              }}
            >
              {expanded ? 'Свернуть' : 'Подробнее'}
            </UnstyledButton>
          )}
        </Group>
      </Group>

      <Text size="sm">{notification.event}</Text>

      {(notification.object_name || notification.paid) && (
        <Group gap={6} mt={4} wrap="wrap">
          {notification.object_name && (
            <Text size="xs" c="dimmed">
              {notification.object_name}
            </Text>
          )}
          {notification.paid ? (
            <Text size="xs" c="green">
              оплачен
            </Text>
          ) : null}
        </Group>
      )}

      {expanded && hasExtra && (
        <Text size="sm" c="dimmed" mt={4} style={{ whiteSpace: 'pre-wrap' }}>
          {notification.message}
        </Text>
      )}
    </Box>
  );
}
