import { useCallback } from 'react';
import { useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

/** Параметры хука для перетаскивания групп. */
export interface UseGroupedInvoiceTableDragDropParams {
  groups: { counterparty: string }[];
  onReorderGroups?: (counterpartyOrder: string[]) => void;
}

/**
 * Хук для управления перетаскиванием групп контрагентов.
 * Создаёт сенсоры и обрабатывает событие завершения перетаскивания.
 */
export function useGroupedInvoiceTableDragDrop({
  groups,
  onReorderGroups,
}: UseGroupedInvoiceTableDragDropParams) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = groups.findIndex((g) => g.counterparty === active.id);
      const newIndex = groups.findIndex((g) => g.counterparty === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(
        groups.map((g) => g.counterparty),
        oldIndex,
        newIndex,
      );

      onReorderGroups?.(newOrder);
    },
    [groups, onReorderGroups],
  );

  return { sensors, handleDragEnd };
}
