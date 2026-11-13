import { useState } from 'react';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';

interface InlineRoleCellObjectPickerProps {
  orgId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function InlineRoleCellObjectPicker({
  orgId,
  selected,
  onChange,
}: InlineRoleCellObjectPickerProps) {
  const { data: objects, isLoading } = useAccountingObjects(orgId);
  const [search, setSearch] = useState('');

  if (isLoading) return <Loader size="xs" />;

  if (!objects || objects.length === 0) {
    return (
      <Text size="xs" c="dimmed" fs="italic">
        У организации нет объектов
      </Text>
    );
  }

  const query = search.trim().toLowerCase();
  const filtered = query
    ? objects.filter((object) => object.name.toLowerCase().includes(query))
    : objects;
  const selectedIds = new Set(selected);
  const allFilteredSelected = filtered.every((object) => selectedIds.has(object.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filtered.map((object) => object.id));
      onChange(selected.filter((id) => !filteredIds.has(id)));
      return;
    }

    const next = new Set(selected);
    for (const object of filtered) next.add(object.id);
    onChange(Array.from(next));
  };

  return (
    <Stack gap="xs" w={300}>
      <TextInput
        size="xs"
        placeholder="Поиск объекта"
        aria-label="Поиск объекта"
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />
      <Group justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed">
          Выбрано {selected.length} из {objects.length}
        </Text>
        <Button size="compact-xs" variant="subtle" onClick={toggleAll}>
          {allFilteredSelected ? 'Снять все' : 'Выбрать все'}
        </Button>
      </Group>
      <ScrollArea.Autosize mah={240} type="auto">
        <CheckboxGroup value={selected} onChange={onChange}>
          <Stack gap={4}>
            {filtered.map((object) => (
              <Checkbox key={object.id} value={object.id} label={object.name} size="xs" />
            ))}
          </Stack>
        </CheckboxGroup>
      </ScrollArea.Autosize>
      {filtered.length === 0 && (
        <Text size="xs" c="dimmed">
          Ничего не найдено
        </Text>
      )}
    </Stack>
  );
}
