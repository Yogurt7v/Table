import type { DocumentStatusFilter } from '@/features/documents/hooks/use-docs-page/docs-page-types';
import { ActionIcon, Autocomplete, Box, Button, Menu, MultiSelect } from '@mantine/core';
import {
  IconCheck,
  IconFilter,
  IconSearch,
  IconX,
} from '@tabler/icons-react';

interface FilterMenuProps {
  filterRef: React.RefObject<HTMLDivElement | null>;
  filterOpened: boolean;
  setFilterOpened: React.Dispatch<React.SetStateAction<boolean>>;
  activeFilterCount: number;
  sortOrder: 'new' | 'old' | null;
  setSortOrder: React.Dispatch<React.SetStateAction<'new' | 'old' | null>>;
  statusFilter: DocumentStatusFilter | null;
  setStatusFilter: React.Dispatch<React.SetStateAction<DocumentStatusFilter | null>>;
  counterpartyOptions: string[];
  filterCounterparty: string;
  setFilterCounterparty: React.Dispatch<React.SetStateAction<string>>;
  objects: { id: string; name: string }[];
  objectOptions: { value: string; label: string }[];
  filterObjectIds: string[];
  setFilterObjectIds: React.Dispatch<React.SetStateAction<string[]>>;
  resetFilters: () => void;
  setPages: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

/** Меню фильтров: сортировка, статус, контрагент, объекты, сброс. */
export function FilterMenu({
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
  setPages,
}: FilterMenuProps) {
  return (
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
  );
}
