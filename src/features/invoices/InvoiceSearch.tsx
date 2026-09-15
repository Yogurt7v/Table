import { ActionIcon, Button, Group, TextInput } from '@mantine/core';
import { IconArrowsHorizontal, IconSearch, IconX } from '@tabler/icons-react';
import { useSearch } from '@/shared/context/SearchContext';

interface InvoiceSearchProps {
  stretch?: boolean;
}

export function InvoiceSearch({ stretch = false }: InvoiceSearchProps) {
  const { searchText, setSearchText, searchAll, setSearchAll } = useSearch();

  return (
    <Group gap="xs" wrap="nowrap" w={stretch ? '100%' : undefined}>
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
        w={stretch ? undefined : { base: '100%', sm: 260 }}
        style={stretch ? { flex: 1, minWidth: 0 } : undefined}
        size="sm"
      />
      {searchText && !searchAll && (
        <Button
          className="invoice-search-btn"
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
