import { Table } from '@mantine/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/** Пропсы обёртки для перетаскиваемой группы. */
export interface SortableGroupBodyProps {
  id: string;
  children: (ctx: {
    listeners: object | undefined;
    isDragging: boolean;
    isOver: boolean;
  }) => React.ReactNode;
}

/**
 * Обёртка для перетаскиваемой группы счетов.
 * Применяет стили перетаскивания и отслеживает состояние наведения.
 */
export function SortableGroupBody({ id, children }: SortableGroupBodyProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, index, overIndex } =
    useSortable({ id });

  const isOver = !isDragging && overIndex === index;

  return (
    <Table.Tbody
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      {...attributes}
    >
      {children({ listeners, isDragging, isOver })}
    </Table.Tbody>
  );
}

/** Пропсы обёртки для статической группы. */
export interface StaticGroupBodyProps {
  children: (ctx: {
    listeners: object | undefined;
    isDragging: boolean;
    isOver: boolean;
  }) => React.ReactNode;
}

/**
 * Обёртка для статической группы счетов (без перетаскивания).
 * Рендерит простой tbody без drag-and-drop логики.
 */
export function StaticGroupBody({ children }: StaticGroupBodyProps) {
  return (
    <Table.Tbody>
      {children({ listeners: undefined, isDragging: false, isOver: false })}
    </Table.Tbody>
  );
}
