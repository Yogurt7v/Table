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
import { ALL_INVOICE_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from './invoice-columns';
import type { InvoiceColumnId } from '@/shared/types';

interface InvoiceColumnSettingsModalProps {
  opened: boolean;
  value: InvoiceColumnId[];
  onChange: (columns: InvoiceColumnId[]) => void;
  onClose: () => void;
}

interface ColumnItem {
  id: InvoiceColumnId;
  label: string;
  visible: boolean;
}

function SortableColumn({
  item,
  onToggle,
}: {
  item: ColumnItem;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      withBorder
      p="xs"
      {...attributes}
      {...listeners}
    >
      <Group gap="sm" wrap="nowrap">
        <IconGripVertical size={16} style={{ cursor: 'grab', color: 'var(--mantine-color-gray-5)' }} />
        <Checkbox
          label={item.label}
          checked={item.visible}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          style={{ flex: 1 }}
        />
      </Group>
    </Paper>
  );
}

function buildInitialItems(value: InvoiceColumnId[]): ColumnItem[] {
  const visibleSet = new Set(value);
  const result: ColumnItem[] = [];
  const added = new Set<InvoiceColumnId>();

  for (const id of value) {
    const def = ALL_INVOICE_COLUMNS.find((c) => c.id === id);
    if (def) {
      result.push({ id, label: def.label, visible: true });
      added.add(id);
    }
  }

  for (const def of ALL_INVOICE_COLUMNS) {
    if (!added.has(def.id)) {
      result.push({ id: def.id, label: def.label, visible: false });
    }
  }

  return result;
}

export function InvoiceColumnSettingsModal({
  opened,
  value,
  onChange,
  onClose,
}: InvoiceColumnSettingsModalProps) {
  const [items, setItems] = useState<ColumnItem[]>(() => buildInitialItems(value));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    setItems(arrayMove(items, oldIndex, newIndex));
  };

  const handleToggle = (id: InvoiceColumnId) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i)));
  };

  const handleReset = () => {
    setItems(buildInitialItems(DEFAULT_VISIBLE_COLUMNS));
  };

  const handleSave = () => {
    const visible = items.filter((i) => i.visible).map((i) => i.id);
    onChange(visible);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Настройка колонок" size="sm">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Перетащите колонки для изменения порядка, отметьте видимые
        </Text>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableColumn
                key={item.id}
                item={item}
                onToggle={() => handleToggle(item.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        <Group justify="space-between" mt="md">
          <Button variant="subtle" onClick={handleReset}>
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
