import { ActionIcon, Button, Group, TextInput } from '@mantine/core';
import { IconArrowsHorizontal, IconSearch, IconX } from '@tabler/icons-react';
import { useSearch } from '@/shared/context/SearchContext';

export function InvoiceSearch() {
  const { searchText, setSearchText, searchAll, setSearchAll } = useSearch();

  return (
    <Group gap="xs">
      <TextInput
        leftSection={<IconSearch size={16} />}
        rightSection={
          searchText ? (
            <ActionIcon variant="subtle" size="sm" onClick={() => setSearchText('')}>
              <IconX size={14} />
            </ActionIcon>
          ) : null
        }
        placeholder="Поиск по счетам..."
        value={searchText}
        onChange={(e) => {
          setSearchText(e.currentTarget.value);
          setSearchAll(false);
        }}
        w={{ base: '100%', sm: 260 }}
        size="sm"
      />
      {searchText && !searchAll && (
        <Button
          variant="light"
          size="compact-sm"
          leftSection={<IconArrowsHorizontal size={16} />}
          onClick={() => setSearchAll(true)}
        >
          Искать в других датах
        </Button>
      )}
    </Group>
  );
}
