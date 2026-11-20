import { useMemo } from 'react';
import type { MailType } from '@/shared/types';
import {
  buildMailThread,
  type MailLetterIndex,
  type MailNodeKey,
  type MailThreadGraph,
} from '@/features/mail/mail-thread';
import {
  buildThreadLine,
  type ThreadDirection,
  type ThreadLineLayout,
} from '@/features/mail/mail-thread-builder';
import type { DetachedLetter } from './mail-thread-builder-types';

/** Параметры расчёта линии писем. */
export interface UseMailThreadLayoutParams {
  graph: MailThreadGraph | undefined;
  letters: MailLetterIndex | undefined;
  anchorKey: MailNodeKey;
  ranks: ReadonlyMap<MailNodeKey, number>;
  detached: DetachedLetter | null;
  rootMailType: MailType;
  rootMailId: string;
}

/**
 * Линия писем конструктора и направления шагов.
 * Собирает линию из графа и порядка пользователя, а снятое сбросом письмо
 * дорисовывает последним корнем, пока связь не появится снова.
 *
 * Направление шага (предок, потомок или само открытое письмо) считается тем же
 * обходом, что у дерева, поэтому конструктор и цепочка внутри формы читаются
 * одинаково.
 */
export function useMailThreadLayout({
  graph,
  letters,
  anchorKey,
  ranks,
  detached,
  rootMailType,
  rootMailId,
}: UseMailThreadLayoutParams) {
  const layout = useMemo<ThreadLineLayout | null>(() => {
    const base = graph
      ? buildThreadLine({ graph, letters, anchor: anchorKey, order: ranks })
      : null;
    if (!base || !detached || base.nodes.some((node) => node.key === detached.key)) return base;
    return {
      ...base,
      nodes: [
        ...base.nodes,
        {
          key: detached.key,
          type: detached.type,
          id: detached.id,
          depth: 0,
          parentKey: null,
          letter: letters?.get(detached.key),
          index: base.nodes.length,
        },
      ],
    };
  }, [graph, letters, anchorKey, ranks, detached]);

  const directions = useMemo(() => {
    const map = new Map<MailNodeKey, ThreadDirection>();
    map.set(anchorKey, 'anchor');
    if (!graph) return map;
    const thread = buildMailThread(graph, { key: anchorKey, type: rootMailType, id: rootMailId });
    for (const node of thread.ancestors) map.set(node.key, 'up');
    for (const node of thread.descendants) map.set(node.key, 'down');
    return map;
  }, [graph, anchorKey, rootMailType, rootMailId]);

  return { layout, directions };
}
