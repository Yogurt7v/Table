import { Box, Loader, Text } from '@mantine/core';
import { IconMailOff } from '@tabler/icons-react';
import { MailFiltersReset } from '@/features/mail/MailFilters';

/** Пропсы пустого состояния таблицы писем. */
export interface MailTableEmptyStateProps {
  loading: boolean;
  emptyHint: string;
  hasFilters: boolean;
  onResetFilters: () => void;
}

/**
 * Пустое состояние таблицы писем.
 * Рендерит индикатор загрузки либо иконку отсутствия писем с подсказкой и
 * сбросом фильтров.
 */
export function MailTableEmptyState({
  loading,
  emptyHint,
  hasFilters,
  onResetFilters,
}: MailTableEmptyStateProps) {
  return (
    <Box ta="center" py="xl">
      {loading ? (
        <>
          {/* Идёт загрузка писем */}
          <Loader size="sm" />
          <Text c="dimmed" mt="xs">
            Загрузка писем…
          </Text>
        </>
      ) : (
        <>
          {/* Писем нет: подсказка и кнопка сброса фильтров */}
          <IconMailOff size={36} stroke={1.5} style={{ color: 'var(--mantine-color-gray-5)' }} />
          <Text c="dimmed" mt="xs">
            {emptyHint}
          </Text>
          {hasFilters && <MailFiltersReset onReset={onResetFilters} />}
        </>
      )}
    </Box>
  );
}
