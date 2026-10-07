import { THREAD_MAX_DEPTH } from './mail-thread';
import type { MailLetter, MailLetterIndex, MailNodeKey, MailThreadGraph } from './mail-thread';
import type { MailType } from '@/shared/types';

/**
 * Разметка конструктора переписки: вертикальная линия писем, у каждого узла
 * своя глубина и свой родитель, между соседями — пустые зоны для сброса.
 *
 * Модуль чистый: ни React, ни сети. Всю болезненную часть с relations и обходом
 * графа он берёт готовой (`mail-thread.ts`), а добавляет ровно то, чего там нет:
 *
 *  1. **Ветку целиком, а не от корня.** `buildMailThread` показывает корень и две
 *     стороны от него; конструктору нужна одна линия сверху вниз, поэтому сверху
 *     стоит верхний предок, а открытое письмо — обычный узел этой линии.
 *  2. **Порядок соседей из настройки пользователя.** Иерархия есть в связях,
 *     порядок между соседями — нет, и по датам он не восстанавливается: это
 *     решение человека, поэтому оно хранится (`mail-thread-order.ts`).
 *  3. **Зоны сброса.** Список узлов дополнен промежутками: сброс в промежуток —
 *     это позиция между соседями, а не новый уровень вложенности.
 *
 * Обход защищён так же, как в `mail-thread`: посещённый узел второй раз не
 * раскрывается, глубина упирается в `THREAD_MAX_DEPTH`. Иначе цикл
 * `A → B → A` уводил бы разметку в бесконечную рекурсию, а ромб `A → C ← B`
 * показал бы `C` дважды.
 */

/** Отступ на один уровень вложенности. Шаг взят у дерева — новая и старая формы читаются как одна система. */
export const MAIL_TREE_INDENT = 22;

/** Письмо без даты уходит в конец списка, а не в начало. */
const UNDATED_SORT_KEY = '9999-12-31';
const UNSEQUENCED_SORT_VALUE = Number.MAX_SAFE_INTEGER;

/** Ранг письма, которого в сохранённом порядке нет: после всех перечисленных. */
const UNORDERED_RANK = Number.MAX_SAFE_INTEGER;

/** Узел линии: письмо, его глубина и родитель — ровно то, что рисует строка. */
export interface ThreadLineNode {
  readonly key: MailNodeKey;
  readonly type: MailType;
  readonly id: string;
  /** Шаг от начала цепочки: у верхнего письма 0. */
  readonly depth: number;
  /** Родитель в разметке; `null` — письмо начинает цепочку. */
  readonly parentKey: MailNodeKey | null;
  readonly letter: MailLetter | undefined;
  /** Позиция в линии сверху вниз. */
  readonly index: number;
}

/** Готовая линия плюс индексы, без которых сброс нельзя разрешить. */
export interface ThreadLineLayout {
  /** Узлы сверху вниз: от корня цепочки к её концу. */
  readonly nodes: readonly ThreadLineNode[];
  /** Ключи, с которых начинаются цепочки, в порядке показа. */
  readonly roots: readonly MailNodeKey[];
  /** `родитель → дети` в порядке показа. Дети цепочек лежат под ключом `null`. */
  readonly children: ReadonlyMap<MailNodeKey | null, readonly MailNodeKey[]>;
  /** Сколько писем обход не показал: повторно встреченные или за пределом глубины. */
  readonly skipped: number;
}

/** Ключ письма в линии — строка из `mail-thread` вида `incoming:abc`. */
export type ThreadAnchor = MailNodeKey;

/** Направление шага относительно открытого письма. */
export type ThreadDirection = 'anchor' | 'up' | 'down';

/** Как линия отвечает на сброс: спокойная, цель принятия или цель отказа. */
export type ThreadOverState = 'none' | 'ok' | 'bad';

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

export interface ThreadLineInput {
  readonly graph: MailThreadGraph;
  readonly letters: MailLetterIndex | undefined;
  readonly anchor: ThreadAnchor;
  /** Сохранённый порядок соседей: ключ → его позиция. */
  readonly order: ReadonlyMap<MailNodeKey, number>;
  readonly maxDepth?: number;
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

/**
 * Идентификаторы зон сброса. Префиксы разные, потому что в ключе письма есть
 * своё двоеточие и по нему одному разбирать нельзя.
 */
const NODE_DROP_PREFIX = 'node:';
const GAP_HEAD_ID = 'gap:head';
const GAP_TAIL_ID = 'gap:tail';
const GAP_BEFORE_PREFIX = 'gap:before:';

/** Промежуток: над первым письмом, под последним или перед конкретным соседом. */
export type MailGapZone =
  | { readonly kind: 'head' }
  | { readonly kind: 'tail' }
  | { readonly kind: 'before'; readonly before: MailNodeKey };

export type MailDropZone =
  | { readonly kind: 'node'; readonly key: MailNodeKey }
  | { readonly kind: 'gap'; readonly gap: MailGapZone };

export function mailNodeDropId(key: MailNodeKey): string {
  return `${NODE_DROP_PREFIX}${key}`;
}

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

/** Куда именно попадёт письмо в сохранённом порядке соседей. */
export type MailOrderPlacement =
  | { readonly kind: 'keep' }
  | { readonly kind: 'first' }
  | { readonly kind: 'last' }
  | { readonly kind: 'at'; readonly index: number };

/** Итог сброса: новый родитель и место в сохранённом порядке соседей. */
export interface DropResolution {
  readonly parentKey: MailNodeKey | null;
  readonly placement: MailOrderPlacement;
}

/**
 * Разрешение сброса. Три цели ровно три, как и обещает интерфейс: на письмо —
 * ответ на него; в промежуток — сосед на уровне соседей; над первым письлом или
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

/** Есть ли в линии хоть одно отношение — иначе переписку ещё не строили. */
export function hasAnyRelation(layout: ThreadLineLayout): boolean {
  return layout.nodes.length > 1;
}
