import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import type { DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { MailNodeKey } from '@/features/mail/mail-thread';
import {
  descendantKeys,
  mailNodeDropId,
  parseDropZone,
  resolveDrop,
  type MailOrderPlacement,
  type ThreadLineLayout,
  type ThreadOverState,
} from '@/features/mail/mail-thread-builder';
import {
  candidateByKey,
  parentEdgesOf,
  planLinkChange,
  type MailCandidateLookup,
  type ParentEdgeIndex,
} from '@/features/mail/mail-parent';
import type { useMailLinkChange } from '@/features/mail/useMailLinkChange';
import { MAIL_CYCLE_NOTIFICATION } from '@/features/mail/mail-thread-labels';
import type { DetachedLetter } from './mail-thread-builder-types';

/** Параметры перетаскивания писем в конструкторе. */
export interface UseMailThreadDragParams {
  layout: ThreadLineLayout | null;
  anchorKey: MailNodeKey;
  candidates: MailCandidateLookup | undefined;
  parentEdges: ParentEdgeIndex | undefined;
  linkChange: ReturnType<typeof useMailLinkChange>;
  place: (
    dragged: MailNodeKey,
    parentKey: MailNodeKey | null,
    placement: MailOrderPlacement,
    siblings: readonly MailNodeKey[],
  ) => void;
  onDetached: (letter: DetachedLetter | null) => void;
}

/**
 * Перетаскивание писем в конструкторе переписки.
 * Хранит тянущееся письмо и зону под курсором, считает допустимость сброса
 * (`resolution`) и по отпусканию применяет связь, порядок и пометку о сбросе.
 *
 * Курсор отвечает на допустимость цели, а не на сам факт перетаскивания:
 * недопустимая зона должна быть видна до отпускания, иначе «письмо пропало»
 * читается как потеря связи.
 */
export function useMailThreadDrag({
  layout,
  anchorKey,
  candidates,
  parentEdges,
  linkChange,
  place,
  onDetached,
}: UseMailThreadDragParams) {
  const [draggedKey, setDraggedKey] = useState<MailNodeKey | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const forbidden = useMemo(
    () => (layout && draggedKey ? descendantKeys(layout, draggedKey) : null),
    [layout, draggedKey],
  );

  const resolution = useMemo(() => {
    if (!layout || !draggedKey || !overId) return null;
    const zone = parseDropZone(overId);
    if (!zone) return null;
    return resolveDrop(layout, zone, draggedKey);
  }, [layout, draggedKey, overId]);

  useEffect(() => {
    if (!draggedKey) return;
    document.body.style.cursor = resolution ? 'grabbing' : 'not-allowed';
    return () => {
      document.body.style.cursor = '';
    };
  }, [draggedKey, resolution]);

  const nodeOverState = (key: MailNodeKey): ThreadOverState => {
    if (!draggedKey || overId !== mailNodeDropId(key)) return 'none';
    return resolution ? 'ok' : 'bad';
  };

  const gapOverState = (id: string): ThreadOverState => {
    if (!draggedKey || overId !== id) return 'none';
    return resolution ? 'ok' : 'bad';
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedKey(event.active.id as MailNodeKey);
    setOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? (event.over.id as string) : null);
  };

  const resetDrag = () => {
    setDraggedKey(null);
    setOverId(null);
  };

  /** Переносит письмо на выбранное место: связь, порядок и пометка о сбросе. */
  const applyDrop = async (
    dragged: MailNodeKey,
    placement: MailOrderPlacement,
    parent: MailNodeKey | null,
  ) => {
    const node = layout?.nodes.find((candidate) => candidate.key === dragged);
    if (!node) return;

    const existing = parentEdgesOf(parentEdges, dragged);
    const next = candidateByKey(candidates, parent);
    const plan = planLinkChange(existing, next);

    if (plan) {
      try {
        await linkChange.changeLink({ child: { id: node.id, type: node.type }, plan });
      } catch {
        return;
      }
    }

    if (placement.kind !== 'keep') {
      place(dragged, parent, placement, layout?.children.get(parent) ?? []);
    }
    onDetached(
      parent === null && dragged !== anchorKey
        ? { key: dragged, type: node.type, id: node.id }
        : null,
    );
    if (parent !== null && forbidden?.has(parent)) {
      notifications.show({ color: 'yellow', message: MAIL_CYCLE_NOTIFICATION });
    }
  };

  const handleDragEnd = async () => {
    const dragged = draggedKey;
    const current = resolution;
    resetDrag();
    if (!dragged || !current) return;
    await applyDrop(dragged, current.placement, current.parentKey);
  };

  return {
    draggedKey,
    overId,
    nodeOverState,
    gapOverState,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    resetDrag,
  };
}
