/**
 * Дерево переписки — граф поверх `mail_relations`.
 * Публичный API сохранён по пути `@/features/mail/mail-thread` (barrel-реэкспорт).
 *
 * Модуль чистый (кроме загрузки писем/связей из PocketBase): разбор строк связи,
 * построение списков смежности и рекурсивный обход. Экран занимается лишь
 * отрисовкой готового дерева.
 *
 * Главное отличие от `relationEndpoints` (`mail-relations.ts`): тот читает по
 * одной паре полей — той, что соответствует регистру, из которого открыли
 * модалку, — поэтому связь «исходящий родитель → входящий ребёнок» для входящей
 * стороны не существует вовсе. Здесь обе стороны разбираются независимо, и все
 * четыре поля участвуют в построении рёбер.
 */

export type {
  MailNodeKey,
  MailEdgeEnd,
  MailEdgeSide,
  MailEdge,
  MailLetter,
  MailLetterIndex,
  MailThreadGraph,
  MailThreadNode,
  MailThread,
  OrgMailLetters,
} from './mail-thread/types.ts';

export {
  mailNodeKey,
  mailEdgeEnd,
  resolveRelationEdge,
  buildMailThreadGraph,
} from './mail-thread/graph.ts';

export {
  THREAD_MAX_DEPTH,
  buildMailThread,
  detectCyclicNodeKeys,
} from './mail-thread/traversal.ts';

export {
  buildLetterIndex,
  fetchOrgMailRelations,
  fetchOrgMailLetters,
} from './mail-thread/letters.ts';
