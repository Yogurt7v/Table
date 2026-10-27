import { useState } from 'react';
import { Modal, Stack, Group, Checkbox, Button, Text, Paper } from '@mantine/core';
import { IconGripVertical } from '@tabler/icons-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DEFAULT_DOCUMENT_COLUMNS, DOCUMENT_COLUMNS } from './document-columns';
import type { DocumentColumnId } from '@/shared/types';

interface DocumentColumnSettingsModalProps {
  opened: boolean;
  value: DocumentColumnId[];
  onChange: (columns: DocumentColumnId[]) => void;
  onClose: () => void;
}

interface ColumnItem {
  id: DocumentColumnId;
  label: string;
  visible: boolean;
}

function SortableColumn({ item, onToggle }: { item: ColumnItem; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <Paper
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      withBorder
      p="xs"
      {...attributes}
      {...listeners}
    >
      <Group gap="sm" wrap="nowrap">
        <IconGripVertical
          size={16}
          style={{ cursor: 'grab', color: 'var(--mantine-color-gray-5)' }}
        />
        <Checkbox
          label={item.label}
          checked={item.visible}
          onChange={onToggle}
          onClick={(event) => event.stopPropagation()}
          style={{ flex: 1 }}
        />
      </Group>
    </Paper>
  );
}

function buildItems(value: DocumentColumnId[]): ColumnItem[] {
  const result: ColumnItem[] = [];
  const added = new Set<DocumentColumnId>();
  for (const id of value) {
    const definition = DOCUMENT_COLUMNS.find((column) => column.id === id);
    if (!definition) continue;
    result.push({ id, label: definition.label, visible: true });
    added.add(id);
  }
  for (const definition of DOCUMENT_COLUMNS) {
    if (!added.has(definition.id)) {
      result.push({ id: definition.id, label: definition.label, visible: false });
    }
  }
  return result;
}

export function DocumentColumnSettingsModal({
  opened,
  value,
  onChange,
  onClose,
}: DocumentColumnSettingsModalProps) {
  const [items, setItems] = useState<ColumnItem[]>(() => buildItems(value));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setItems(arrayMove(items, oldIndex, newIndex));
  };

  const handleSave = () => {
    onChange(items.filter((item) => item.visible).map((item) => item.id));
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Настройка колонок" size="sm">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Перетащите колонки для изменения порядка, отметьте видимые
        </Text>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableColumn
                key={item.id}
                item={item}
                onToggle={() =>
                  setItems((current) =>
                    current.map((entry) =>
                      entry.id === item.id ? { ...entry, visible: !entry.visible } : entry,
                    ),
                  )
                }
              />
            ))}
          </SortableContext>
        </DndContext>
        <Group justify="space-between" mt="md">
          <Button variant="subtle" onClick={() => setItems(buildItems(DEFAULT_DOCUMENT_COLUMNS))}>
            Сбросить
          </Button>
          <Group gap="sm">
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
