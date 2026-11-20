/**
 * Публичный API конструктора переписки: разметка линии писем и зоны перетаскивания.
 * Сохранён путь импорта `@/features/mail/mail-thread-builder`.
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

export { MAIL_TREE_INDENT } from './mail-thread-builder/constants.ts';

export type {
  ThreadLineNode,
  ThreadLineLayout,
  ThreadAnchor,
  ThreadDirection,
  ThreadOverState,
  ThreadLineInput,
  MailGapZone,
  MailDropZone,
  MailOrderPlacement,
  DropResolution,
} from './mail-thread-builder/types.ts';

export { buildThreadLine, descendantKeys, hasAnyRelation } from './mail-thread-builder/line.ts';

export {
  mailNodeDropId,
  mailGapDropId,
  parseDropZone,
  resolveDrop,
} from './mail-thread-builder/drop-zone.ts';
