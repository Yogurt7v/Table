import { pb } from '@/api/client';
import {
  MAIL_INCOMING_COLLECTION,
  MAIL_OUTGOING_COLLECTION,
  MAIL_RELATIONS_COLLECTION,
} from '@/api/mail';
import type { IIncomingMail, IMailRelation, IOutgoingMail, MailType } from '@/shared/types';
import { relationCounterparty, relationNumber } from './mail-relations';

/**
 * Дерево переписки — граф поверх `mail_relations`. Никакого React: здесь только
 * разбор строк связи, построение списков смежности и рекурсивный обход. Экран
 * (`MailThreadModal.tsx`) занимается лишь отрисовкой готового дерева.
 *
 * Главное отличие от `relationEndpoints` (`mail-relations.ts`): тот читает по
 * одной паре полей — той, что соответствует регистру, из которого открыли
 * модалку, — поэтому связь «исходящий родитель → входящий ребёнок» для входящей
 * стороны не существует вовсе. Здесь обе стороны разбираются независимо, и все
 * четыре поля участвуют в построении рёбер.
 */

/** Ключ письма в графе — `incoming:av97cwn9zwc7gck`. Голый id не годится: письма лежат в двух коллекциях и теоретически могут иметь один id. */
export type MailNodeKey = `${MailType}:${string}`;

/** Конец связи: id письма вместе с регистром, в котором оно живёт. */
export type MailEdgeEnd = {
  readonly key: MailNodeKey;
  readonly type: MailType;
  readonly id: string;
};

/** Сторона связи. Регистр выбирается независимо от стороны — см. `END_BY_SIDE_AND_TYPE`. */
export type MailEdgeSide = 'parent' | 'child';

export type MailEdge = {
  readonly relationId: string;
  readonly parent: MailEdgeEnd;
  readonly child: MailEdgeEnd;
};

/** Всё, что строке письма нужно в дереве: подписи для экрана и ключи сортировки. */
export type MailLetter = {
  readonly key: MailNodeKey;
  readonly date: string;
  readonly seq: number;
  readonly number: string;
  readonly counterparty: string;
  readonly subject: string;
};

export type MailLetterIndex = ReadonlyMap<MailNodeKey, MailLetter>;

/**
 * Списки смежности в обе стороны, названные по направлению шага, а не по
 * строению ребра: `up` ведёт к тому, на что письмо отвечает, `down` — к тем,
 * кто ответил. Ключ — узел, значение — соседи, уже в порядке отображения.
 */
export type MailThreadGraph = {
  readonly up: ReadonlyMap<MailNodeKey, readonly MailEdgeEnd[]>;
  readonly down: ReadonlyMap<MailNodeKey, readonly MailEdgeEnd[]>;
};

export type MailThreadNode = {
  readonly key: MailNodeKey;
  readonly type: MailType;
  readonly id: string;
  /** Шаг от корня: у корня 0, у ближайшего соседа 1. */
  readonly depth: number;
  /** Истина только у корня — того письма, из которого открыли модалку. */
  readonly isRoot: boolean;
};

export type MailThread = {
  readonly root: MailThreadNode;
  /** Вверх по цепочке: ближайший родитель — `depth` 1, его родитель — 2. */
  readonly ancestors: readonly MailThreadNode[];
  /** Вниз по ветке, в обходе в глубину, поэтому `depth` растёт при углублении. */
  readonly descendants: readonly MailThreadNode[];
  /** Сколько писем обход не показал: повторно встреченное или за пределом глубины. */
  readonly skipped: number;
};

/** Ключ узла по регистру и id. Единственное место, где формат ключа задан. */
export function mailNodeKey(type: MailType, id: string): MailNodeKey {
  return `${type}:${id}`;
}

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

/** Письма одного регистра в общую карту подписей. */
function addLetters(
  index: Map<MailNodeKey, MailLetter>,
  type: MailType,
  mails: readonly (IIncomingMail | IOutgoingMail)[],
): void {
  for (const mail of mails) {
    const key = mailNodeKey(type, mail.id);
    index.set(key, {
      key,
      date: mail.date,
      seq: mail.seq ?? UNSEQUENCED_SORT_VALUE,
      number: relationNumber(type, mail),
      counterparty: relationCounterparty(type, mail),
      subject: mail.subject,
    });
  }
}

/**
 * `ключ → строка письма` для организации. В `mail_relations` хранятся только id,
 * а `useIncomingMail`/`useOutgoingMail` на каждый узел дали бы N+1 — поэтому
 * письма читаются по регистру целиком и раскладываются в карту один раз.
 */
export function buildLetterIndex(
  incoming: readonly IIncomingMail[],
  outgoing: readonly IOutgoingMail[],
): MailLetterIndex {
  const index = new Map<MailNodeKey, MailLetter>();
  addLetters(index, 'incoming', incoming);
  addLetters(index, 'outgoing', outgoing);
  return index;
}

const LETTER_FIELDS =
  'id,organization_id,date,seq,number,outgoing_number,sender,recipient,subject,responsible';

const RELATION_FIELDS =
  'id,organization_id,parent_incoming_mail_id,parent_outgoing_mail_id,child_incoming_mail_id,child_outgoing_mail_id';

export type OrgMailLetters = {
  readonly incoming: readonly IIncomingMail[];
  readonly outgoing: readonly IOutgoingMail[];
};

/**
 * Связи всей организации одним запросом — по образцу `useOrgMailFiles`. Сбор
 * «связи этого письма» (`getIncomingMailRelations`) для дерева не годится: ветка
 * тянется в обе стороны, и любая выборка обрывает её за пределами первого шага.
 * Фильтр по организации обязателен — иначе в дерево попало бы чужое письмо с
 * тем же id.
 */
export function fetchOrgMailRelations(orgId: string): Promise<IMailRelation[]> {
  return pb.collection(MAIL_RELATIONS_COLLECTION).getFullList<IMailRelation>({
    filter: `organization_id = "${orgId}"`,
    fields: RELATION_FIELDS,
    sort: 'created',
  });
}

/**
 * Письма организации — по одному запросу на регистр. Цена не зависит от размера
 * дерева: вместе со связями это ровно три запроса на открытие модалки, сколько
 * бы ветвей ни было.
 */
export function fetchOrgMailLetters(orgId: string): Promise<OrgMailLetters> {
  const filter = `organization_id = "${orgId}"`;
  const options = { filter, fields: LETTER_FIELDS, sort: 'date,seq' };
  return Promise.all([
    pb.collection(MAIL_INCOMING_COLLECTION).getFullList<IIncomingMail>(options),
    pb.collection(MAIL_OUTGOING_COLLECTION).getFullList<IOutgoingMail>(options),
  ]).then(([incoming, outgoing]) => ({ incoming, outgoing }));
}
