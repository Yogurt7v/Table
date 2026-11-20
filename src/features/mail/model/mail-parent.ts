/**
 * Подсказка о связи по номеру контрагента — без React и без сети.
 * Публичный API сохранён по пути `@/features/mail/mail-parent` (barrel-реэкспорт).
 *
 * **Номер не определяет связь.** Связь живёт в `mail_relations`, и она —
 * единственный факт; номер контрагента — текст, который человек вводит и
 * который контрагент нумерует по-своему. Поэтому всё, что делает этот модуль,
 * — предлагает, а не решает: `suggestParent` отвечает на вопрос «на какое
 * письмо это похоже», и ответ обязан быть подтверждён человеком
 * (`ParentIntent` → `intendedParentKey`).
 *
 * Ключ связи задан самой схемой и зеркален для обоих регистров:
 *
 * | поле письма                             | ищется в                    |
 * |-----------------------------------------|-----------------------------|
 * | `incoming.sender_outgoing_number`       | `outgoing.outgoing_number`   |
 * | `outgoing.counterparty_incoming_number` | `incoming.number`           |
 *
 * Уникального индекса на этих полях нет, поэтому совпадений может быть
 * сколько угодно: два письма с одинаковым номером — норма, а не аномалия.
 * Отсюда второе правило модуля: **никогда не выбирать первое совпадение
 * молча**. Один кандидат показывается для подтверждения, несколько —
 * спрашиваются у пользователя, ноль — начинает новую цепочку.
 */

export {
  PARENT_REGISTER_BY_TYPE,
  PENDING_PARENT_INTENT,
  type MailCandidate,
  type MailCandidateLookup,
  type ParentSuggestion,
  type ParentIntent,
  type ParentEdgeIndex,
  type LinkChangePlan,
} from './mail-parent/types.ts';

export {
  normalizeLinkNumber,
  buildCandidateLookup,
  findParentCandidates,
  candidateByKey,
  parentOptionLabel,
  parentSelectOptions,
  suggestParent,
} from './mail-parent/candidates.ts';

export {
  intendedParentKey,
  buildParentEdgeIndex,
  parentEdgesOf,
  planLinkChange,
} from './mail-parent/planning.ts';
