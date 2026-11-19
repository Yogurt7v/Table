/** Построение линии писем вокруг якоря: выбор родителей, обход и индексы потомков. */

import { THREAD_MAX_DEPTH } from '../mail-thread';
import type { MailLetterIndex, MailNodeKey, MailThreadGraph } from '../mail-thread';
import type { MailType } from '@/shared/types';
import type { ThreadLineInput, ThreadLineLayout, ThreadLineNode } from './types';

/** Письмо без даты уходит в конец списка, а не в начало. */
const UNDATED_SORT_KEY = '9999-12-31';
const UNSEQUENCED_SORT_VALUE = Number.MAX_SAFE_INTEGER;

/** Ранг письма, которого в сохранённом порядке нет: после всех перечисленных. */
const UNORDERED_RANK = Number.MAX_SAFE_INTEGER;

/**
 * Порядок между соседями: сначала сохранённый пользователем, затем порядок
 * самого реестра — дата и `seq` по убыванию, то есть ровно `LIVE_MAIL_SORT`.
 * Ключ в конце делает порядок тотальным и независимым от порядка строк в ответе
 * PocketBase. Письма, которых в сохранённом порядке нет, не теряются: они
 * встают после перечисленных, в порядке реестра.
 */
function compareByOrderThenRegister(
  a: MailNodeKey,
  b: MailNodeKey,
  order: ReadonlyMap<MailNodeKey, number>,
  letters: MailLetterIndex | undefined,
): number {
  const rankA = order.get(a) ?? UNORDERED_RANK;
  const rankB = order.get(b) ?? UNORDERED_RANK;
  if (rankA !== rankB) return rankA - rankB;

  const left = letters?.get(a);
  const right = letters?.get(b);
  const byDate = (right?.date || UNDATED_SORT_KEY).localeCompare(left?.date || UNDATED_SORT_KEY);
  if (byDate !== 0) return byDate;
  const bySeq = (right?.seq ?? UNSEQUENCED_SORT_VALUE) - (left?.seq ?? UNSEQUENCED_SORT_VALUE);
  if (bySeq !== 0) return bySeq;
  return a.localeCompare(b);
}

type NodeEnds = ReadonlyMap<MailNodeKey, { readonly type: MailType; readonly id: string }>;

/** Ключ без ключа: единственное место, где строка разбирается на части. */
function splitKey(key: MailNodeKey): { type: MailType; id: string } {
  const separator = key.indexOf(':');
  return {
    type: key.slice(0, separator) === 'incoming' ? 'incoming' : 'outgoing',
    id: key.slice(separator + 1),
  };
}

/**
 * Ключи одной связной компоненты письма: вверх и вниз по графу, без повторов.
 * Компонента, а не ветка от корня: перетаскивать можно и письмо, которое
 * сейчас ни на что не отвечает, — иначе половина цепочек осталась бы вне
 * конструктора вовсе.
 */
function collectComponent(
  graph: MailThreadGraph,
  anchorKey: MailNodeKey,
): { component: ReadonlySet<MailNodeKey>; ends: NodeEnds } {
  const component = new Set<MailNodeKey>([anchorKey]);
  const ends = new Map<MailNodeKey, { type: MailType; id: string }>();
  const queue: MailNodeKey[] = [anchorKey];

  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) break;
    const neighbours = [...(graph.up.get(current) ?? []), ...(graph.down.get(current) ?? [])];
    for (const end of neighbours) {
      if (!ends.has(end.key)) ends.set(end.key, { type: end.type, id: end.id });
      if (component.has(end.key)) continue;
      component.add(end.key);
      queue.push(end.key);
    }
  }
  return { component, ends };
}

/** Глубина, которой достигает письмо, при выборе из нескольких родителей. */
const UNREACHABLE_DEPTH = Number.MAX_SAFE_INTEGER;

/** Проходов выбора родителя достаточно: каждый проход опускает письмо вглубь не более чем на уровень. */
const PARENT_SETTLE_PASSES = 3;

/**
 * Глубины при уже выбранных родителях. Письма, до которых не дошёл обход от
 * корней (замыкание кольца), глубины не получают вовсе — иначе пришлось бы
 * угадывать, где в кольце «начало», а так они просто считаются самыми глубокими,
 * и выбор родителя для них остаётся первым из списка.
 */
function chosenDepths(
  parents: ReadonlyMap<MailNodeKey, MailNodeKey | null>,
  component: ReadonlySet<MailNodeKey>,
): ReadonlyMap<MailNodeKey, number> {
  const children = new Map<MailNodeKey, MailNodeKey[]>();
  for (const key of component) {
    const parent = parents.get(key) ?? null;
    if (parent === null) continue;
    const bucket = children.get(parent);
    if (bucket) {
      bucket.push(key);
    } else {
      children.set(parent, [key]);
    }
  }

  const depths = new Map<MailNodeKey, number>();
  const queue: MailNodeKey[] = [];
  for (const key of component) {
    if ((parents.get(key) ?? null) === null) {
      depths.set(key, 0);
      queue.push(key);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    if (current === undefined) break;
    const next = (depths.get(current) ?? 0) + 1;
    for (const child of children.get(current) ?? []) {
      if (depths.has(child)) continue;
      depths.set(child, next);
      queue.push(child);
    }
  }
  return depths;
}

/**
 * Родитель каждого письма в разметке.
 *
 * Письмо вправе отвечать сразу нескольким («это ответ и на заявку, и на
 * договор»), и в базе это несколько строк связи. Показывать такую письмо
 * глубже всех — значит превратить линию в лестницу, поэтому выбирается тот
 * родитель, который сам лежит ближе к началу: письмо висит на ближайшей к корню
 * ветке, а линия остаётся ветвящейся. Правило сходится за несколько проходов,
 * потому что смена одного родителя меняет глубины следующего.
 *
 * Родителем может быть только сосед по компоненте: связь с письмом вне неё не
 * должна вытаскивать чужую цепочку в эту линию. Кандидаты уже упорядочены
 * `buildMailThreadGraph` (дата, затем `seq`), поэтому при равенстве глубин
 * побеждает первый — выбор детерминирован независимо от порядка строк в ответе.
 */
function resolveParents(
  graph: MailThreadGraph,
  component: ReadonlySet<MailNodeKey>,
): ReadonlyMap<MailNodeKey, MailNodeKey | null> {
  const candidates = new Map<MailNodeKey, MailNodeKey[]>();
  for (const key of component) {
    candidates.set(
      key,
      (graph.up.get(key) ?? []).map((end) => end.key).filter((parent) => component.has(parent)),
    );
  }

  const chosen = new Map<MailNodeKey, MailNodeKey | null>();
  for (const [key, list] of candidates) chosen.set(key, list[0] ?? null);

  for (let pass = 0; pass < PARENT_SETTLE_PASSES; pass += 1) {
    const depths = chosenDepths(chosen, component);
    let changed = false;

    for (const [key, list] of candidates) {
      if (list.length < 2) continue;
      let best = list[0];
      if (best === undefined) continue;
      for (const candidate of list) {
        if (
          (depths.get(candidate) ?? UNREACHABLE_DEPTH) < (depths.get(best) ?? UNREACHABLE_DEPTH)
        ) {
          best = candidate;
        }
      }
      if (best !== chosen.get(key)) {
        chosen.set(key, best);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return chosen;
}

/**
 * Линия писем вокруг якоря. Письма, у которых родитель лежит вне компоненты,
 * начинают цепочку; те, до кого обход не дошёл (замыкание кольца), тоже — иначе
 * они не попали бы в разметку вовсе, а перетаскивать было бы нечего.
 */
export function buildThreadLine(input: ThreadLineInput): ThreadLineLayout {
  const { graph, letters, order } = input;
  const maxDepth = input.maxDepth ?? THREAD_MAX_DEPTH;

  const { component, ends } = collectComponent(graph, input.anchor);
  const parents = resolveParents(graph, component);
  const sorted = [...component].sort((a, b) => compareByOrderThenRegister(a, b, order, letters));

  // Дети собираются из родителей, поэтому ребро `A → B` читается ровно так же,
  // как его записывали: `B` ребёнок `A`. Письма без родителя копятся под
  // ключом `null` — это несколько цепочек, начинающихся подряд.
  const children = new Map<MailNodeKey | null, MailNodeKey[]>();
  for (const key of sorted) {
    const parent = parents.get(key) ?? null;
    const bucket = children.get(parent);
    if (bucket) {
      bucket.push(key);
    } else {
      children.set(parent, [key]);
    }
  }
  for (const bucket of children.values()) {
    bucket.sort((a, b) => compareByOrderThenRegister(a, b, order, letters));
  }

  const nodes: ThreadLineNode[] = [];
  const emitted = new Set<MailNodeKey>();
  let skipped = 0;

  const walk = (key: MailNodeKey, depth: number): void => {
    emitted.add(key);
    const identity = ends.get(key) ?? splitKey(key);
    nodes.push({
      key,
      type: identity.type,
      id: identity.id,
      depth,
      parentKey: parents.get(key) ?? null,
      letter: letters?.get(key),
      index: nodes.length,
    });
    if (depth >= maxDepth) {
      // Глубже предела не идём, но сколько детей осталось за кадром — говорим:
      // иначе ветка выглядела бы законченной.
      skipped += (children.get(key) ?? []).length;
      return;
    }
    for (const child of children.get(key) ?? []) {
      if (emitted.has(child)) {
        skipped += 1;
        continue;
      }
      walk(child, depth + 1);
    }
  };

  const roots: MailNodeKey[] = [];
  const startFrom = (key: MailNodeKey) => {
    if (emitted.has(key)) return;
    roots.push(key);
    walk(key, 0);
  };

  for (const key of children.get(null) ?? []) startFrom(key);
  // Письмо, до которого обход не добрался (кольцо), тоже попадает в линию —
  // иначе счётчик «пропущено» объяснял бы его отсутствие пустым местом.
  for (const key of sorted) startFrom(key);

  return { nodes, roots, children, skipped };
}

/**
 * Письма, лежащие ниже `key`: именно они недопустимы для сброса, потому что
 * сброс на своего потомка замкнул бы цепочку. Само письмо в множество не входит —
 * оно отбрасывается отдельно и по другому основанию.
 */
export function descendantKeys(
  layout: ThreadLineLayout,
  key: MailNodeKey,
): ReadonlySet<MailNodeKey> {
  const found = new Set<MailNodeKey>();
  const queue: MailNodeKey[] = [key];

  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) break;
    for (const child of layout.children.get(current) ?? []) {
      if (found.has(child)) continue;
      found.add(child);
      queue.push(child);
    }
  }
  return found;
}

/** Есть ли в линии хоть одно отношение — иначе переписку ещё не строили. */
export function hasAnyRelation(layout: ThreadLineLayout): boolean {
  return layout.nodes.length > 1;
}
