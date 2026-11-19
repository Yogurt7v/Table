import { Box, Button, Text } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';

interface GroupedInvoiceTableEmptyStateProps {
  canCreate: boolean;
  onAddClick?: () => void;
}

/**
 * Пустое состояние таблицы: когда за дату нет счетов и черновик не открыт.
 * Кнопка «Добавить счёт» — только при праве создания и наличии обработчика.
 */
export function GroupedInvoiceTableEmptyState({
  canCreate,
  onAddClick,
}: GroupedInvoiceTableEmptyStateProps) {
  return (
    <Box ta="center" py="xl">
      <IconInbox size={36} stroke={1.5} style={{ color: 'var(--mantine-color-gray-5)' }} />
      <Text c="dimmed" mt="xs">
        Нет счетов на эту дату
      </Text>
      {canCreate && onAddClick && (
        <Button variant="light" size="compact-sm" mt="sm" onClick={onAddClick}>
          Добавить счёт
        </Button>
      )}
    </Box>
  );
}
