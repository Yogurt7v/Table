/** Типы узлов, рёбер, писем и графа переписки. */

import type { IIncomingMail, IMailRelation, IOutgoingMail, MailType } from '@/shared/types';

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

/** Ребро графа переписки: одна строка `mail_relations`. */
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

/** Индекс писем по ключу узла графа. */
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

/** Узел дерева переписки в обходе от корня. */
export type MailThreadNode = {
  readonly key: MailNodeKey;
  readonly type: MailType;
  readonly id: string;
  /** Шаг от корня: у корня 0, у ближайшего соседа 1. */
  readonly depth: number;
  /** Истина только у корня — того письма, из которого открыли модалку. */
  readonly isRoot: boolean;
};

/** Результат обхода переписки: корень, предки, потомки и число пропущенных узлов. */
export type MailThread = {
  readonly root: MailThreadNode;
  /** Вверх по цепочке: ближайший родитель — `depth` 1, его родитель — 2. */
  readonly ancestors: readonly MailThreadNode[];
  /** Вниз по ветке, в обходе в глубину, поэтому `depth` растёт при углублении. */
  readonly descendants: readonly MailThreadNode[];
  /** Сколько писем обход не показал: повторно встреченное или за пределом глубины. */
  readonly skipped: number;
};

/** Письма одного регистра, используемые при построении индекса. */
export type MailRegisterLetter = IIncomingMail | IOutgoingMail;

/** Строка связи писем из `mail_relations`. */
export type MailRelationRow = IMailRelation;

/** Письма организации, загруженные по регистрами для построения индекса. */
export type OrgMailLetters = {
  readonly incoming: readonly IIncomingMail[];
  readonly outgoing: readonly IOutgoingMail[];
};
