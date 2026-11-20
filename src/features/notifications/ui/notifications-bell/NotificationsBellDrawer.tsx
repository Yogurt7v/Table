import {
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { NotificationBlock } from './NotificationBlock';
import { LOAD_ERROR_TITLE, formatFullDate } from './notifications-bell-utils';
import type { NotificationsBellModel } from './useNotificationsBell';

/**
 * Выдвижная панель уведомлений: список (с ошибкой/загрузкой/пустым состоянием
 * и пагинацией) и календарь для просмотра уведомлений за конкретный день.
 */
export function NotificationsBellDrawer({ model }: { model: NotificationsBellModel }) {
  const {
    opened,
    close,
    calendarDate,
    setCalendarDate,
    viewDate,
    setViewDate,
    clearDate,
    showToday,
    isLoading,
    isLoadingMore,
    hasMore,
    unreadCount,
    error,
    retryNow,
    loadMore,
    markAsRead,
    markAllAsRead,
    usedNotifications,
    listLoading,
    handleNavigate,
  } = model;

  return (
    <Drawer
      opened={opened}
      onClose={close}
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
      {/* Счётчик и видимость кнопки идут от серверного итога `unreadCount`, а не от
          загруженных строк: «Прочитать все» помечает весь список на сервере одним
          запросом, и непрочитанные могут лежать выше страницы «Показать ещё». */}
      {unreadCount > 0 && !isLoading && (
        <Button variant="light" size="xs" fullWidth mb="sm" onClick={markAllAsRead}>
          Прочитать все ({unreadCount})
        </Button>
      )}

      <ScrollArea
        type="auto"
        style={{ flex: 1, minHeight: 0 }}
        styles={{ viewport: { maxHeight: 'none' } }}
      >
        {/* Ошибка загрузки: баннер с деталями и повтором, если текст отличается от шапки */}
        {error && (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            title={LOAD_ERROR_TITLE}
            mb="sm"
            data-testid="notifications-error-banner"
          >
            {error !== LOAD_ERROR_TITLE && (
              <Text size="xs" data-testid="notifications-error-detail">
                {error}
              </Text>
            )}
            <Button
              variant="light"
              color="red"
              size="xs"
              mt="xs"
              onClick={retryNow}
              data-testid="notifications-retry"
            >
              Повторить
            </Button>
          </Alert>
        )}

        {/* Состояния списка: загрузка, пусто (без баннера ошибки) или карточки */}
        {listLoading ? (
          <Center h={120}>
            <Loader />
          </Center>
        ) : usedNotifications.length === 0 ? (
          error ? null : (
            <Center h={120}>
              <Text c="dimmed" data-testid="notifications-empty">
                {calendarDate ? 'Нет уведомлений за этот день' : 'Нет уведомлений'}
              </Text>
            </Center>
          )
        ) : (
          <Stack gap="xs" data-testid="notifications-list">
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

      {/* Календарь: выбор дня, быстрый переход на «сегодня» и возврат к последним */}
      <Box style={{ flexShrink: 0 }}>
        <Divider my="sm" />

        <Text size="xs" c="dimmed" mb={4}>
          {calendarDate ? formatFullDate(calendarDate.toISOString()) : 'Выберите дату в календаре'}
        </Text>

        <Button
          size="xs"
          variant="light"
          fullWidth
          mb="xs"
          disabled={calendarDate !== null && dayjs(calendarDate).isSame(dayjs(), 'day')}
          onClick={showToday}
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
            <Button size="xs" variant="subtle" onClick={clearDate}>
              Показать последние
            </Button>
          </Group>
        )}
      </Box>
    </Drawer>
  );
}
