/** Построение графа переписки из строк связей и порядок соседей. */

import type { IMailRelation, MailType } from '@/shared/types';
import type {
  MailEdge,
  MailEdgeEnd,
  MailEdgeSide,
  MailLetterIndex,
  MailNodeKey,
  MailThreadGraph,
} from './types';

/** Ключ узла по регистру и id. Единственное место, где формат ключа задан. */
export function mailNodeKey(type: MailType, id: string): MailNodeKey {
  return `${type}:${id}`;
}

/** Конец ребра по регистру и id. */
export function mailEdgeEnd(type: MailType, id: string): MailEdgeEnd {
  return { key: mailNodeKey(type, id), type, id };
}

/**
 * Четыре поля связи — по одному на пару (сторона, регистр). Порядок таблицы
 * задан и потому, что он правило разрешения: если заполнены оба поля стороны,
 * побеждает входящий регистр.
 */
const END_BY_SIDE_AND_TYPE = [
  { side: 'parent', type: 'incoming', read: (r: IMailRelation) => r.parent_incoming_mail_id },
  { side: 'parent', type: 'outgoing', read: (r: IMailRelation) => r.parent_outgoing_mail_id },
  { side: 'child', type: 'incoming', read: (r: IMailRelation) => r.child_incoming_mail_id },
  { side: 'child', type: 'outgoing', read: (r: IMailRelation) => r.child_outgoing_mail_id },
] as const;

/** Заполненный конец с одной стороны. Оба поля пусты — стороны нет. */
function resolveEnd(relation: IMailRelation, side: MailEdgeSide): MailEdgeEnd | null {
  for (const field of END_BY_SIDE_AND_TYPE) {
    if (field.side !== side) continue;
    const id = field.read(relation);
    if (id) return mailEdgeEnd(field.type, id);
  }
  return null;
}

/**
 * Ровно одно ребро на строку `mail_relations`. Стороны разбираются независимо,
 * поэтому «входящий → исходящий» и «исходящий → входящий» дают настоящие
 * межрегистровые рёбра. Строка с незаполненной стороной пропускается целиком:
 * узел с пустым id невозможен, а половина связи ничего не значит.
 */
export function resolveRelationEdge(relation: IMailRelation): MailEdge | null {
  const parent = resolveEnd(relation, 'parent');
  const child = resolveEnd(relation, 'child');
  if (!parent || !child) return null;
  return { relationId: relation.id, parent, child };
}

/** Письмо без даты уходит в конец списка, а не в начало. */
const UNDATED_SORT_KEY = '9999-12-31';
/** Письмо без seq уходит в конец списка. */
const UNSEQUENCED_SORT_VALUE = Number.MAX_SAFE_INTEGER;

/**
 * Порядок соседей: дата, затем `seq`, затем ключ. Последний компонент делает
 * порядок тотальным — список не зависит от порядка строк в ответе
 * PocketBase, который для `getFullList` без явного `sort` не задан.
 */
function compareEnds(a: MailEdgeEnd, b: MailEdgeEnd, letters: MailLetterIndex): number {
  const left = letters.get(a.key);
  const right = letters.get(b.key);
  const byDate = (left?.date || UNDATED_SORT_KEY).localeCompare(right?.date || UNDATED_SORT_KEY);
  if (byDate !== 0) return byDate;
  const bySeq = (left?.seq ?? UNSEQUENCED_SORT_VALUE) - (right?.seq ?? UNSEQUENCED_SORT_VALUE);
  if (bySeq !== 0) return bySeq;
  return a.key.localeCompare(b.key);
}

/** Добавляет конец ребра в список смежности, создавая список при необходимости. */
function pushEnd(adjacency: Map<MailNodeKey, MailEdgeEnd[]>, from: MailNodeKey, to: MailEdgeEnd) {
  const ends = adjacency.get(from);
  if (ends) {
    ends.push(to);
    return;
  }
  adjacency.set(from, [to]);
}

const EMPTY_LETTERS: MailLetterIndex = new Map();

/**
 * Граф переписки организации из строк `mail_relations`. Письмо попадает в граф
 * только если упомянуто хотя бы одной связью, поэтому посторонние письма
 * организации в дерево не проникают. `letters` нужен только для порядка
 * соседей; без него сравнение дойдёт до ключа и останется детерминированным.
 */
export function buildMailThreadGraph(
  relations: readonly IMailRelation[],
  letters: MailLetterIndex = EMPTY_LETTERS,
): MailThreadGraph {
  const up = new Map<MailNodeKey, MailEdgeEnd[]>();
  const down = new Map<MailNodeKey, MailEdgeEnd[]>();
  const linked = new Set<string>();

  for (const relation of relations) {
    const edge = resolveRelationEdge(relation);
    if (!edge) continue;
    // Повторная строка связи (или дважды созданная) даёт то же самое ребро —
    // иначе письмо показалось бы в дереве дважды.
    const pair = `${edge.parent.key}>${edge.child.key}`;
    if (!linked.has(pair)) {
      linked.add(pair);
      pushEnd(up, edge.child.key, edge.parent);
      pushEnd(down, edge.parent.key, edge.child);
    }
  }

  for (const ends of up.values()) ends.sort((a, b) => compareEnds(a, b, letters));
  for (const ends of down.values()) ends.sort((a, b) => compareEnds(a, b, letters));

  return { up, down };
}
