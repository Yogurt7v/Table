/** Обход графа переписки: построение дерева, поиск циклов и предел глубины. */

import type {
  MailEdgeEnd,
  MailNodeKey,
  MailThread,
  MailThreadGraph,
  MailThreadNode,
} from './types';

/**
 * Предел глубины обхода. Почтовый ящик может ветвиться глубже, а связи не
 * защищены от циклов (защита на записи отклонена), так что без предела
 * `A → B → A` уводил бы обход в бесконечную рекурсию.
 */
export const THREAD_MAX_DEPTH = 12;

type DirectionWalk = {
  readonly nodes: readonly MailThreadNode[];
  /** Сколько соседей обход отбросил: сходящиеся пути или то, что за пределом глубины. */
  readonly skipped: number;
};

/**
 * Один обход в одну сторону. `visited` создаётся здесь и потому общий для всех
 * уровней рекурсии: созданный внутри шага он обнулялся бы на каждом входе и
 * защищал бы ровно от ничего.
 */
function walkDirection(
  step: ReadonlyMap<MailNodeKey, readonly MailEdgeEnd[]>,
  rootKey: MailNodeKey,
  maxDepth: number,
): DirectionWalk {
  const visited = new Set<MailNodeKey>([rootKey]);
  const nodes: MailThreadNode[] = [];
  let skipped = 0;

  const descend = (from: MailNodeKey, depth: number): void => {
    for (const end of step.get(from) ?? []) {
      if (visited.has(end.key) || depth > maxDepth) {
        skipped += 1;
        continue;
      }
      visited.add(end.key);
      nodes.push({ key: end.key, type: end.type, id: end.id, depth, isRoot: false });
      descend(end.key, depth + 1);
    }
  };

  descend(rootKey, 1);
  return { nodes, skipped };
}

/**
 * Дерево вокруг `root`: вверх до первого письма и вниз по всей ветке.
 *
 * У каждого направления свой обход, поэтому письмо показывается один раз в
 * каждом из них, а не «где-то»: цикл `A → B → A` даёт `B` и в предках, и в
 * потомках — по обоим направлениям оно и правда сосед. Ромб `A → C ← B`
 * показывает `C` по первому пути (первый задаёт порядок соседей выше), второй
 * путь сходится и считается в `skipped`. Общего счётчика на два обхода нет
 * намеренно — иначе письмо, найденное сначала вверх, исчезло бы из ветки вниз и
 * «пропущено» считало бы несуществующие потери.
 */
export function buildMailThread(
  graph: MailThreadGraph,
  root: MailEdgeEnd,
  maxDepth: number = THREAD_MAX_DEPTH,
): MailThread {
  const up = walkDirection(graph.up, root.key, maxDepth);
  const down = walkDirection(graph.down, root.key, maxDepth);

  return {
    root: { key: root.key, type: root.type, id: root.id, depth: 0, isRoot: true },
    ancestors: up.nodes,
    descendants: down.nodes,
    skipped: up.skipped + down.skipped,
  };
}

/**
 * Письма, входящие в цикл: узлы, у которых ребро ведёт в того, кто уже
 * достижим из них самих. Ребро `A → B` замыкает цикл тогда и только тогда,
 * когда из `B` можно дойти до `A`.
 *
 * Обход не идёт в уже посещённые узлы и упирается в `maxDepth`, а потому
 * цикл длиннее предела считается лишь частично — как и в `walkDirection`.
 * Замыкание в пределах предела гарантированно найдено: путь длины не больше
 * `maxDepth` целиком лежит внутри обхода.
 *
 * Множество достижимости кешируется по узлу, поэтому обходов столько, сколько
 * узлов, а не столько, сколько рёбер — на ветвистой переписке разница в
 * десятки раз.
 */
export function detectCyclicNodeKeys(
  graph: MailThreadGraph,
  maxDepth: number = THREAD_MAX_DEPTH,
): ReadonlySet<MailNodeKey> {
  const reachableCache = new Map<MailNodeKey, ReadonlySet<MailNodeKey>>();

  const reachableFrom = (origin: MailNodeKey): ReadonlySet<MailNodeKey> => {
    const cached = reachableCache.get(origin);
    if (cached) return cached;
    const found = reachableWithin(graph.down, origin, maxDepth);
    reachableCache.set(origin, found);
    return found;
  };

  const cyclic = new Set<MailNodeKey>();
  for (const [from, ends] of graph.down) {
    for (const end of ends) {
      if (!reachableFrom(end.key).has(from)) continue;
      cyclic.add(from);
      cyclic.add(end.key);
    }
  }
  return cyclic;
}

/**
 * Узлы, достижимые из `origin` шагами вниз, без рекурсии в посещённые узлы.
 * Стек хранит глубину, а `visited` не даёт ни вернуться назад, ни размножить
 * обход ромба: письмо, достигнутое вторым путём, второй раз не раскрывается.
 */
function reachableWithin(
  step: ReadonlyMap<MailNodeKey, readonly MailEdgeEnd[]>,
  origin: MailNodeKey,
  maxDepth: number,
): ReadonlySet<MailNodeKey> {
  const visited = new Set<MailNodeKey>([origin]);
  const stack: { key: MailNodeKey; depth: number }[] = [{ key: origin, depth: 0 }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame || frame.depth >= maxDepth) continue;
    for (const end of step.get(frame.key) ?? []) {
      if (visited.has(end.key)) continue;
      visited.add(end.key);
      stack.push({ key: end.key, depth: frame.depth + 1 });
    }
  }
  return visited;
}
