import { Group, Select, Text, TextInput, ActionIcon } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';
import { PAGE_SIZE_OPTIONS } from '@/features/documents/hooks/use-docs-page/docs-page-types';

interface SearchAndPageSizeProps {
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  setPages: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

/** Поиск и выбор размера страницы. */
export function SearchAndPageSize({
  search,
  onSearchChange,
  onClearSearch,
  pageSize,
  onPageSizeChange,
  setPages,
}: SearchAndPageSizeProps) {
  return (
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
  );
}
