import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  buildLetterIndex,
  buildMailThreadGraph,
  detectCyclicNodeKeys,
  fetchOrgMailLetters,
  fetchOrgMailRelations,
  type MailLetterIndex,
  type MailThreadGraph,
  type MailNodeKey,
} from './mail-thread';
import { buildCandidateLookup, buildParentEdgeIndex } from './mail-parent';
import type { MailCandidateLookup, ParentEdgeIndex } from './mail-parent';

/**
 * Переписка организации целиком: связи, оба регистра писем и производные от
 * них карты — одним запросом на коллекцию и тремя `useMemo`.
 *
 * Тот же приём, что в `useOrgMailFiles`, и по той же причине. Разбирать связь
 * по одной письму (`getIncomingMailRelations`/`getOutgoingMailRelations`, то есть
 * `useMailRelations`) для формы не годится: номер контрагента может совпасть с
 * письмом, которого на открытой странице реестра нет вовсе, а ветка тянется в
 * обе стороны и любая выборка обрывает её за пределом первого шага. Один
 * org-wide запрос стоит одинаково при трёх письмах и при трёх тысячах.
 *
 * Ключ `['mailThread', orgId]` — тот же, что был у запроса в `MailThreadModal`,
 * поэтому дерево переписки и форма читают один кэш и не удваивают загрузку.
 */
export function useOrgMailThread(orgId: string) {
  const query = useQuery({
    queryKey: ['mailThread', orgId],
    queryFn: async () => {
      const [relations, letters] = await Promise.all([
        fetchOrgMailRelations(orgId),
        fetchOrgMailLetters(orgId),
      ]);
      return { relations, incoming: letters.incoming, outgoing: letters.outgoing };
    },
    enabled: !!orgId,
  });

  const loaded = query.data;

  /** Подписи писем для дерева: ключ → номер, контрагент, дата, тема. */
  const letters = useMemo<MailLetterIndex | undefined>(
    () => (loaded ? buildLetterIndex(loaded.incoming, loaded.outgoing) : undefined),
    [loaded],
  );

  /** Списки смежности в обе стороны. Порядок соседей зависит от `letters`. */
  const graph = useMemo<MailThreadGraph | undefined>(
    () => (loaded ? buildMailThreadGraph(loaded.relations, letters) : undefined),
    [loaded, letters],
  );

  /** Письма, входящие в цикл; помечаются при отрисовке, а не запрещаются на записи. */
  const cyclicKeys = useMemo<ReadonlySet<MailNodeKey> | undefined>(
    () => (graph ? detectCyclicNodeKeys(graph) : undefined),
    [graph],
  );

  /** Кандидаты в родители: свёрнутый номер → письма, плюс плоский список для выбора. */
  const candidates = useMemo<MailCandidateLookup | undefined>(
    () => (loaded ? buildCandidateLookup(loaded.incoming, loaded.outgoing) : undefined),
    [loaded],
  );

  /** Уже записанные связи: ребёнок → рёбра, где он ребёнок. Основание для пересвязывания. */
  const parentEdges = useMemo<ParentEdgeIndex | undefined>(
    () => (loaded ? buildParentEdgeIndex(loaded.relations) : undefined),
    [loaded],
  );

  return {
    ...query,
    letters,
    graph,
    cyclicKeys,
    candidates,
    parentEdges,
  };
}