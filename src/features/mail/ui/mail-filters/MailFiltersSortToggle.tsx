import { Button } from '@mantine/core';
import { IconChevronsDown, IconChevronsUp } from '@tabler/icons-react';
import type { UseMailFiltersResult } from '@/features/mail/hooks/useMailFilters';

/**
 * Переключатель порядка рядом с кнопкой «Фильтр». Подпись и aria-label
 * описывают действие клика, а не текущее состояние: «Сначала новые»
 * обещает показать старые.
 */
export function MailFiltersSortToggle({ filters }: { filters: UseMailFiltersResult }) {
  const isAsc = filters.sortDirection === 'asc';

  return (
    <Button
      size="compact-sm"
      variant="light"
      color="gray"
      style={{ padding: '0 20px' }}
      data-mail-sort-toggle
      aria-label={isAsc ? 'Показать сначала новые письма' : 'Показать сначала старые письма'}
      leftSection={isAsc ? <IconChevronsUp size={16} /> : <IconChevronsDown size={16} />}
      onClick={filters.toggleSortDirection}
    >
      {isAsc ? 'Сначала старые' : 'Сначала новые'}
    </Button>
  );
}
