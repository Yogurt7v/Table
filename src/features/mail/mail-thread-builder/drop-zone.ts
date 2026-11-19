/** Зоны сброса писем: идентификаторы, разбор и разрешение перетаскивания. */

import type { MailNodeKey } from '../mail-thread';
import { descendantKeys } from './line.ts';
import type { DropResolution, MailDropZone, MailGapZone, ThreadLineLayout } from './types';

/**
 * Идентификаторы зон сброса. Префиксы разные, потому что в ключе письма есть
 * своё двоеточие и по нему одному разбирать нельзя.
 */
const NODE_DROP_PREFIX = 'node:';
const GAP_HEAD_ID = 'gap:head';
const GAP_TAIL_ID = 'gap:tail';
const GAP_BEFORE_PREFIX = 'gap:before:';

/** Идентификатор droppable-зоны письма (сброс «ответить на письмо»). */
export function mailNodeDropId(key: MailNodeKey): string {
  return `${NODE_DROP_PREFIX}${key}`;
}

/** Идентификатор droppable-зоны промежутка (сброс «вставить между соседями»). */
export function mailGapDropId(gap: MailGapZone): string {
  if (gap.kind === 'before') return `${GAP_BEFORE_PREFIX}${gap.before}`;
  return gap.kind === 'head' ? GAP_HEAD_ID : GAP_TAIL_ID;
}

/**
 * Разбор идентификатора зоны обратно в письмо или промежуток. Единственное
 * место, где `string` становится ключом графа: префиксы известны, `as` здесь
 * честнее, чем новый парсер формата ключа рядом с `mailNodeKey`.
 */
export function parseDropZone(id: string): MailDropZone | null {
  if (id.startsWith(NODE_DROP_PREFIX)) {
    return { kind: 'node', key: id.slice(NODE_DROP_PREFIX.length) as MailNodeKey };
  }
  if (id.startsWith(GAP_BEFORE_PREFIX)) {
    const before = id.slice(GAP_BEFORE_PREFIX.length) as MailNodeKey;
    return { kind: 'gap', gap: { kind: 'before', before } };
  }
  if (id === GAP_HEAD_ID) return { kind: 'gap', gap: { kind: 'head' } };
  if (id === GAP_TAIL_ID) return { kind: 'gap', gap: { kind: 'tail' } };
  return null;
}

/**
 * Разрешение сброса. Три цели ровно три, как и обещает интерфейс: на письмо —
 * ответ на него; в промежуток — сосед на уровне соседей; над первым письмом или
 * под последним — начало цепочки. `null` — сюда нельзя, и это видно во время
 * перетаскивания, а не после отпускания.
 */
export function resolveDrop(
  layout: ThreadLineLayout,
  zone: MailDropZone,
  draggedKey: MailNodeKey,
): DropResolution | null {
  const current = layout.nodes.find((node) => node.key === draggedKey)?.parentKey ?? null;

  if (zone.kind === 'node') {
    if (zone.key === draggedKey) return null;
    if (descendantKeys(layout, draggedKey).has(zone.key)) return null;
    if (current === zone.key) {
      // Родитель не меняется — перетаскивание двигает письмо только между
      // соседями, и записывать это незачем: место и так прежнее.
      return { parentKey: zone.key, placement: { kind: 'keep' } };
    }
    // Ответ встаёт последним среди ответов на это письмо: «новый ответ в конце
    // ветки» — положение, которое человек понимает без подсказки.
    return { parentKey: zone.key, placement: { kind: 'last' } };
  }

  if (zone.gap.kind !== 'before') {
    return { parentKey: null, placement: { kind: zone.gap.kind === 'head' ? 'first' : 'last' } };
  }

  const before = zone.gap.before;
  const position = layout.nodes.findIndex((node) => node.key === before);
  if (position <= 0) return null;

  // Промежуток стоит перед письмом, поэтому родитель берётся у предыдущего
  // соседа: письмо встаёт в один уровень с ним, а не следующим шагом вглубь.
  const previous = layout.nodes[position - 1];
  const parentKey = previous?.parentKey ?? null;
  if (parentKey === draggedKey) return null;
  if (parentKey !== null && descendantKeys(layout, draggedKey).has(parentKey)) return null;

  const siblings = layout.children.get(parentKey) ?? [];
  const index = siblings.findIndex((key) => key === before);
  if (index < 0) return null;
  return { parentKey, placement: { kind: 'at', index } };
}
