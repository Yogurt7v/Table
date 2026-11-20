import { Box, Button, Menu } from '@mantine/core';
import { IconCheck, IconFilter, IconX } from '@tabler/icons-react';
import {
  ALL_INVOICE_FILTERS,
  INVOICE_FILTER_LABELS,
  REDUCED_INVOICE_FILTERS,
} from '@/features/invoices/utils/invoice-filter';
import type { InvoiceFilterType } from '@/features/invoices/utils/invoice-filter';

interface InvoiceStatusFilterMenuProps {
  isFullAccess: boolean;
  activeFilters: InvoiceFilterType[];
  onActiveFiltersChange: (filters: InvoiceFilterType[]) => void;
}

/**
 * Меню фильтра по статусу счёта: полный набор для admin/moderator/boss,
 * сокращённый для остальных ролей. Множественный выбор, сброс отдельным пунктом.
 */
export function InvoiceStatusFilterMenu({
  isFullAccess,
  activeFilters,
  onActiveFiltersChange,
}: InvoiceStatusFilterMenuProps) {
  return (
    <Menu shadow="md" width={240} closeOnItemClick={false}>
      <Menu.Target>
        <Button
          size="compact-sm"
          variant="light"
          style={{ padding: '0 20px' }}
          color={activeFilters.length > 0 ? 'blue' : 'gray'}
          leftSection={<IconFilter size={16} />}
        >
          {activeFilters.length > 0 ? `Фильтр (${activeFilters.length})` : 'Фильтр'}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {/* Пункты статуса счёта */}
        <Menu.Label>Статус счёта</Menu.Label>
        {(isFullAccess ? ALL_INVOICE_FILTERS : REDUCED_INVOICE_FILTERS).map((filter) => {
          const isActive = activeFilters.includes(filter);
          return (
            <Menu.Item
              key={filter}
              leftSection={
                isActive ? (
                  <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                ) : (
                  <Box w={16} />
                )
              }
              color={isActive ? 'blue' : undefined}
              onClick={() =>
                onActiveFiltersChange(
                  isActive ? activeFilters.filter((f) => f !== filter) : [...activeFilters, filter],
                )
              }
            >
              {INVOICE_FILTER_LABELS[filter]}
            </Menu.Item>
          );
        })}
        {/* Сброс всех активных фильтров */}
        <Menu.Divider />
        <Menu.Item
          color="red"
          disabled={activeFilters.length === 0}
          leftSection={<IconX size={16} />}
          closeMenuOnClick
          onClick={() => onActiveFiltersChange([])}
        >
          Сбросить
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
