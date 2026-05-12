import { TextInput, Button, Group } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useSearch } from '@/shared/context/SearchContext';

export function InvoiceSearch() {
  const { searchText, setSearchText, searchAll, setSearchAll } = useSearch();

  return (
    <Group gap="xs">
      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder="Поиск по счетам..."
        value={searchText}
        onChange={(e) => {
          setSearchText(e.currentTarget.value);
          setSearchAll(false);
        }}
        w={260}
        size="sm"
      />
      {searchText && !searchAll && (
        <Button
          variant="light"
          size="compact-sm"
          onClick={() => setSearchAll(true)}
        >
          🔍 Искать везде
        </Button>
      )}
    </Group>
  );
}
