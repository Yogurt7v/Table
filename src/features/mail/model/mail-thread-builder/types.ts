/** Типы разметки линии переписки и зон перетаскивания в конструкторе. */

import type { MailLetter, MailLetterIndex, MailNodeKey, MailThreadGraph } from '../mail-thread';
import type { MailType } from '@/shared/types';

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

/** Входные данные для построения линии писем вокруг якоря. */
export interface ThreadLineInput {
  readonly graph: MailThreadGraph;
  readonly letters: MailLetterIndex | undefined;
  readonly anchor: ThreadAnchor;
  /** Сохранённый порядок соседей: ключ → его позиция. */
  readonly order: ReadonlyMap<MailNodeKey, number>;
  readonly maxDepth?: number;
}

/** Промежуток: над первым письмом, под последним или перед конкретным соседом. */
export type MailGapZone =
  | { readonly kind: 'head' }
  | { readonly kind: 'tail' }
  | { readonly kind: 'before'; readonly before: MailNodeKey };

/** Зона сброса: на письмо или в промежуток между письмами. */
export type MailDropZone =
  | { readonly kind: 'node'; readonly key: MailNodeKey }
  | { readonly kind: 'gap'; readonly gap: MailGapZone };

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
