import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  ActionIcon,
  Autocomplete,
  Box,
  Button,
  Group,
  Menu,
  MultiSelect,
  Select,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCheck,
  IconChevronsDown,
  IconChevronsUp,
  IconFilter,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react';

import { PAGE_SIZE_OPTIONS, type DocumentStatusFilter } from './docs-page-types';

interface DocsPageToolbarProps {
  paymentDateRange: [Date | null, Date | null];
  invoiceDateRange: [Date | null, Date | null];
  onPaymentDateRangeChange: (value: [Date | null, Date | null]) => void;
  onInvoiceDateRangeChange: (value: [Date | null, Date | null]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  filterRef: RefObject<HTMLDivElement | null>;
  filterOpened: boolean;
  setFilterOpened: Dispatch<SetStateAction<boolean>>;
  activeFilterCount: number;
  sortOrder: 'new' | 'old' | null;
  setSortOrder: Dispatch<SetStateAction<'new' | 'old' | null>>;
  statusFilter: DocumentStatusFilter | null;
  setStatusFilter: Dispatch<SetStateAction<DocumentStatusFilter | null>>;
  counterpartyOptions: string[];
  filterCounterparty: string;
  setFilterCounterparty: Dispatch<SetStateAction<string>>;
  objects: { id: string; name: string }[];
  objectOptions: { value: string; label: string }[];
  filterObjectIds: string[];
  setFilterObjectIds: Dispatch<SetStateAction<string[]>>;
  resetFilters: () => void;
  collapsedAll: boolean;
  onToggleCollapseAll: () => void;
  canCreate: boolean;
  onCreate: () => void;
  setPages: Dispatch<SetStateAction<Record<string, number>>>;
}

/** Панель управления страницы документов: периоды, поиск, фильтры и действия. */
export function DocsPageToolbar({
  paymentDateRange,
  invoiceDateRange,
  onPaymentDateRangeChange,
  onInvoiceDateRangeChange,
  search,
  onSearchChange,
  onClearSearch,
  pageSize,
  onPageSizeChange,
  filterRef,
  filterOpened,
  setFilterOpened,
  activeFilterCount,
  sortOrder,
  setSortOrder,
  statusFilter,
  setStatusFilter,
  counterpartyOptions,
  filterCounterparty,
  setFilterCounterparty,
  objects,
  objectOptions,
  filterObjectIds,
  setFilterObjectIds,
  resetFilters,
  collapsedAll,
  onToggleCollapseAll,
  canCreate,
  onCreate,
  setPages,
}: DocsPageToolbarProps) {
  return (
    <>
      {/* Периоды фильтрации по датам оплаты и счёта */}
      <Group gap="xs" wrap="wrap" onMouseDown={(e) => e.stopPropagation()}>
        <DatePickerInput
          type="range"
          size="xs"
          label="Период оплаты"
          placeholder="Период"
          aria-label="Период оплаты"
          clearable
          closeOnChange
          allowSingleDateInRange
          valueFormat="DD.MM.YYYY"
          labelSeparator=" – "
          leftSection={<IconFilter size={14} />}
          leftSectionPointerEvents="none"
          value={paymentDateRange}
          popoverProps={{ classNames: { dropdown: 'docs-period-dropdown' } }}
          onChange={(value) => {
            onPaymentDateRangeChange([value[0] ?? null, value[1] ?? null]);
            setPages({});
          }}
        />
        <DatePickerInput
          type="range"
          size="xs"
          label="Период счёта"
          placeholder="Период"
          aria-label="Период счёта"
          clearable
          closeOnChange
          allowSingleDateInRange
          valueFormat="DD.MM.YYYY"
          labelSeparator=" – "
          leftSection={<IconFilter size={14} />}
          leftSectionPointerEvents="none"
          value={invoiceDateRange}
          popoverProps={{ classNames: { dropdown: 'docs-period-dropdown' } }}
          onChange={(value) => {
            onInvoiceDateRangeChange([value[0] ?? null, value[1] ?? null]);
            setPages({});
          }}
        />
      </Group>

      {/* Поиск и размер страницы */}
      <Group justify="space-between" wrap="wrap">
        <TextInput
          w={{ base: '100%', sm: 520 }}
          leftSection={<IconSearch size={16} />}
          rightSection={
            search ? (
              <ActionIcon variant="subtle" aria-label="Очистить поиск" onClick={onClearSearch}>
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          placeholder="Поиск по документам и комментариям"
          value={search}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onSearchChange(event.currentTarget.value)
          }
          aria-label="Поиск документов"
        />
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            На странице
          </Text>
          <Select
            w={80}
            size="sm"
            data={[...PAGE_SIZE_OPTIONS]}
            value={String(pageSize)}
            onChange={(value) => {
              if (!value) return;
              onPageSizeChange(Number(value));
              setPages({});
            }}
            allowDeselect={false}
            aria-label="Размер страницы"
          />
        </Group>
      </Group>

      {/* Фильтры, сворачивание групп и создание документа */}
      <Group gap="xs" wrap="wrap">
        <div ref={filterRef}>
          <Menu
            shadow="md"
            width={280}
            closeOnItemClick={false}
            opened={filterOpened}
            onChange={setFilterOpened}
          >
            <Menu.Target>
              <Button
                size="compact-sm"
                variant="light"
                color={activeFilterCount > 0 ? 'blue' : 'gray'}
                style={{ padding: '0 20px' }}
                leftSection={<IconFilter size={16} />}
              >
                {activeFilterCount > 0 ? `Фильтр (${activeFilterCount})` : 'Фильтр'}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Сортировка</Menu.Label>
              <Menu.Item
                closeMenuOnClick
                leftSection={
                  sortOrder === 'new' ? (
                    <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                  ) : (
                    <Box w={16} />
                  )
                }
                color={sortOrder === 'new' ? 'blue' : undefined}
                onClick={() => {
                  setSortOrder(sortOrder === 'new' ? null : 'new');
                  setPages({});
                }}
              >
                Сначала новые
              </Menu.Item>
              <Menu.Item
                closeMenuOnClick
                leftSection={
                  sortOrder === 'old' ? (
                    <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                  ) : (
                    <Box w={16} />
                  )
                }
                color={sortOrder === 'old' ? 'blue' : undefined}
                onClick={() => {
                  setSortOrder(sortOrder === 'old' ? null : 'old');
                  setPages({});
                }}
              >
                Сначала старые
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Статус</Menu.Label>
              <Menu.Item
                closeMenuOnClick
                leftSection={
                  statusFilter === 'in_progress' ? (
                    <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                  ) : (
                    <Box w={16} />
                  )
                }
                color={statusFilter === 'in_progress' ? 'blue' : undefined}
                onClick={() => {
                  setStatusFilter(statusFilter === 'in_progress' ? null : 'in_progress');
                  setPages({});
                }}
              >
                В работе
              </Menu.Item>
              <Menu.Item
                closeMenuOnClick
                leftSection={
                  statusFilter === 'provided' ? (
                    <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                  ) : (
                    <Box w={16} />
                  )
                }
                color={statusFilter === 'provided' ? 'blue' : undefined}
                onClick={() => {
                  setStatusFilter(statusFilter === 'provided' ? null : 'provided');
                  setPages({});
                }}
              >
                Предоставлен
              </Menu.Item>
              <Menu.Item
                closeMenuOnClick
                leftSection={
                  statusFilter === 'confirmed' ? (
                    <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                  ) : (
                    <Box w={16} />
                  )
                }
                color={statusFilter === 'confirmed' ? 'blue' : undefined}
                onClick={() => {
                  setStatusFilter(statusFilter === 'confirmed' ? null : 'confirmed');
                  setPages({});
                }}
              >
                Подтверждён
              </Menu.Item>
              <Menu.Divider />

              <Box p="xs">
                <Autocomplete
                  size="xs"
                  label="Контрагент"
                  placeholder="Поиск по контрагенту"
                  data={counterpartyOptions}
                  value={filterCounterparty}
                  onChange={(value) => {
                    setFilterCounterparty(value);
                    setPages({});
                  }}
                  leftSection={<IconSearch size={14} />}
                  rightSection={
                    filterCounterparty ? (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="gray"
                        aria-label="Очистить контрагента"
                        onClick={() => {
                          setFilterCounterparty('');
                          setPages({});
                        }}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    ) : null
                  }
                  comboboxProps={{ withinPortal: false }}
                />
              </Box>

              {objects.length > 0 && (
                <>
                  <Menu.Divider />
                  <Menu.Label>Объект</Menu.Label>
                  <Box px="xs" pb={4}>
                    <MultiSelect
                      size="xs"
                      placeholder="Выберите объекты"
                      aria-label="Объект"
                      data={objectOptions}
                      value={filterObjectIds}
                      onChange={(value) => {
                        setFilterObjectIds(value);
                        setPages({});
                      }}
                      comboboxProps={{ withinPortal: false }}
                      hidePickedOptions
                    />
                  </Box>
                  <Menu.Item
                    leftSection={
                      filterObjectIds.length === 0 ? (
                        <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                      ) : (
                        <Box w={16} />
                      )
                    }
                    color={filterObjectIds.length === 0 ? 'blue' : undefined}
                    onClick={() => {
                      setFilterObjectIds([]);
                      setPages({});
                    }}
                  >
                    Все объекты
                  </Menu.Item>
                </>
              )}
              <Menu.Divider />
              <Menu.Item
                color="red"
                disabled={activeFilterCount === 0}
                leftSection={<IconX size={16} />}
                closeMenuOnClick
                onClick={resetFilters}
              >
                Сбросить
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
        <Button
          size="compact-sm"
          variant="light"
          color="gray"
          flex="1"
          rightSection={
            collapsedAll ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />
          }
          onClick={onToggleCollapseAll}
          leftSection={collapsedAll ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
        >
          {collapsedAll ? 'Развернуть' : 'Свернуть'}
        </Button>

        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={onCreate}>
            Добавить документ
          </Button>
        )}
      </Group>
    </>
  );
}
