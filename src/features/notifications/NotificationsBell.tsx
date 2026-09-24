import { useCallback, useMemo, useState } from 'react';
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
  Divider,
  ScrollArea,
  UnstyledButton,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { IconBell, IconBellFilled } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useNotifications, useNotificationsByDate } from '@/shared/hooks/useNotifications';
import { useOrg } from '@/shared/context/OrgContext';
import { useInvoiceNavigation } from '@/shared/context/InvoiceNavigationContext';
import { getInvoice, getDeletedInvoiceByOriginalId } from '@/api/collections';
import type { INotification } from '@/shared/types';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFullDate(dateStr: string) {
  return dayjs(dateStr).format('D MMMM YYYY, dddd');
}

function NotificationBlock({
  notification,
  onNavigate,
  onMarkRead,
}: {
  notification: INotification;
  onNavigate: (n: INotification) => void;
  onMarkRead: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRead = notification.read;
  const hasExtra = notification.message && notification.message !== notification.event;

  const handleClick = () => {
    if (!isRead) onMarkRead(notification.id);
    if (notification.invoice_id) {
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
        backgroundColor: isRead
          ? 'var(--mantine-color-gray-0)'
          : 'var(--mantine-color-blue-0)',
        padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
        cursor: notification.invoice_id ? 'pointer' : 'default',
      }}
    >
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

export function NotificationsBell() {
  const [opened, setOpened] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState<Date>(() => dayjs().startOf('month').toDate());
  const { currentOrgId, setCurrentOrgId } = useOrg();
  const {
    notifications: items,
    isLoading,
    isLoadingMore,
    hasMore,
    unreadCount,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const { requestHighlight } = useInvoiceNavigation();
  const navigate = useNavigate();

  const selectedDateStr = calendarDate ? dayjs(calendarDate).format('YYYY-MM-DD') : '';
  const { data: dateNotifications, isLoading: dateLoading } =
    useNotificationsByDate(selectedDateStr);

  const dayItems = useMemo(() => {
    if (!calendarDate) return null;
    const day = dayjs(calendarDate).format('YYYY-MM-DD');
    return items.filter((n) => dayjs(n.created).format('YYYY-MM-DD') === day);
  }, [calendarDate, items]);

  const usedNotifications = useMemo(() => {
    if (!calendarDate) return items;
    return dateNotifications ?? dayItems ?? [];
  }, [calendarDate, dateNotifications, dayItems, items]);

  const listLoading = calendarDate ? dateLoading : isLoading;

  const handleNavigate = useCallback(
    (n: INotification) => {
      if (!n.read) markAsRead(n.id);
      setOpened(false);
      if (n.organization_id && n.organization_id !== currentOrgId) {
        setCurrentOrgId(n.organization_id);
      }
      if (!n.invoice_id) return;

      if (n.type === 'invoice_deleted') {
        if (!n.organization_id) {
          navigate('/admin?tab=archive');
          return;
        }
        getDeletedInvoiceByOriginalId(n.organization_id, n.invoice_id)
          .then((deleted) => {
            navigate(`/admin?tab=archive&highlight=${encodeURIComponent(deleted.id)}`);
          })
          .catch(() => {
            navigate('/admin?tab=archive');
          });
        return;
      }

      getInvoice(n.invoice_id)
        .then((invoice) => {
          requestHighlight(invoice.id, new Date(dayjs(invoice.date).toISOString()));
        })
        .catch(() => {
          requestHighlight('', new Date());
        });
    },
    [currentOrgId, markAsRead, requestHighlight, setCurrentOrgId, navigate],
  );

  const upcomingCount = items.filter((n) => !n.read).length;

  return (
    <>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        aria-label="Уведомления"
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
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          },
        }}
      >
        {upcomingCount > 0 && !isLoading && (
          <Button variant="light" size="xs" fullWidth mb="sm" onClick={markAllAsRead}>
            Прочитать все ({upcomingCount})
          </Button>
        )}

        <ScrollArea
          type="auto"
          style={{ flex: 1, minHeight: 0 }}
          styles={{ viewport: { maxHeight: 'none' } }}
        >
          {listLoading ? (
            <Center h={120}>
              <Loader />
            </Center>
          ) : usedNotifications.length === 0 ? (
            <Center h={120}>
              <Text c="dimmed">
                {calendarDate ? 'Нет уведомлений за этот день' : 'Нет уведомлений'}
              </Text>
            </Center>
          ) : (
            <Stack gap="xs">
              {usedNotifications.map((n) => (
                <NotificationBlock
                  key={n.id}
                  notification={n}
                  onNavigate={handleNavigate}
                  onMarkRead={markAsRead}
                />
              ))}
              {!calendarDate && hasMore && (
                <Button
                  variant="light"
                  size="xs"
                  fullWidth
                  loading={isLoadingMore}
                  onClick={loadMore}
                >
                  Показать ещё
                </Button>
              )}
            </Stack>
          )}
        </ScrollArea>

        <Box style={{ flexShrink: 0 }}>
          <Divider my="sm" />

          <Text size="xs" c="dimmed" mb={4}>
            {calendarDate
              ? formatFullDate(calendarDate.toISOString())
              : 'Выберите дату в календаре'}
          </Text>

          <Button
            size="xs"
            variant="light"
            fullWidth
            mb="xs"
            disabled={
              calendarDate !== null && dayjs(calendarDate).isSame(dayjs(), 'day')
            }
            onClick={() => {
              const today = dayjs().startOf('day').toDate();
              setCalendarDate(today);
              setViewDate(today);
            }}
          >
            Показать за сегодня
          </Button>

          <Calendar
            date={viewDate}
            onDateChange={setViewDate}
            maxDate={new Date()}
            hideOutsideDates
            getDayProps={(date) => ({
              selected: calendarDate ? dayjs(date).isSame(calendarDate, 'day') : false,
              onClick: () => setCalendarDate(date),
            })}
          />
          {calendarDate && (
            <Group mt="sm">
              <Button size="xs" variant="subtle" onClick={() => setCalendarDate(null)}>
                Показать последние
              </Button>
            </Group>
          )}
        </Box>
      </Drawer>
    </>
  );
}
