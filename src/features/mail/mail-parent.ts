import type { IIncomingMail, IMailRelation, IOutgoingMail, MailType } from '@/shared/types';
import { foldSearchText } from '@/shared/utils/search-text';
import { formatMailDate, toDateKey } from './mail-date';
import { MAIL_EMPTY_CELL, MAIL_REGISTER_BADGE_LABELS } from './mail-labels';
import { relationCounterparty, relationNumber } from './mail-relations';
import { mailNodeKey, resolveRelationEdge } from './mail-thread';
import type { MailEdge, MailNodeKey } from './mail-thread';

/**
 * Подсказка о связи по номеру контрагента — без React и без сети.
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
 * | поле письма                        | ищется в                    |
 * |------------------------------------|-----------------------------|
 * | `incoming.sender_outgoing_number`  | `outgoing.outgoing_number`   |
 * | `outgoing.counterparty_incoming_number` | `incoming.number`      |
 *
 * Уникального индекса на этих полях нет, поэтому совпадений может быть
 * сколько угодно: два письма с одинаковым номером — норма, а не аномалия.
 * Отсюда второе правило модуля: **никогда не выбирать первое совпадение
 * молча**. Один кандидат показывается для подтверждения, несколько —
 * спрашиваются у пользователя, ноль — начинает новую цепочку.
 */

/** Реестр, в котором ищется родитель для письма данного регистра. */
export const PARENT_REGISTER_BY_TYPE: Record<MailType, MailType> = {
  incoming: 'outgoing',
  outgoing: 'incoming',
};

/** Письмо, способное встать родителем: подписи для интерфейса плюс ключ графа. */
export interface MailCandidate {
  readonly key: MailNodeKey;
  readonly type: MailType;
  readonly id: string;
  readonly number: string;
  readonly counterparty: string;
  readonly dateKey: string;
  readonly subject: string;
  readonly seq: number;
}

/**
 * Индекс кандидатов: номер → письма с таким номером, отдельно для каждого
 * регистра-источника. Ключи уже свёрнуты (`foldSearchText`), поэтому искомый
 * номер сворачивается тем же приёмом, и «И-01/2026» находит «и-01/2026».
 */
export interface MailCandidateLookup {
  readonly byNumber: Readonly<Record<MailType, ReadonlyMap<string, readonly MailCandidate[]>>>;
  readonly byKey: ReadonlyMap<MailNodeKey, MailCandidate>;
  /** Все письма организации обоих регистров — список выбора в ручном подборе. */
  readonly all: readonly MailCandidate[];
}

/**
 * Номер для сопоставления: обрезанные края, схлопнутые пробелы и схлопнутые
 * невидимые символы, регистр. Пустая строка после свёртки означает «номера нет»
 * и никогда ни с чем не совпадает.
 */
export function normalizeLinkNumber(value: string | null | undefined): string {
  return foldSearchText(value ?? '');
}

const UNSEQUENCED_SORT_VALUE = Number.MAX_SAFE_INTEGER;

function toCandidate(type: MailType, mail: IIncomingMail | IOutgoingMail): MailCandidate {
  return {
    key: mailNodeKey(type, mail.id),
    type,
    id: mail.id,
    number: relationNumber(type, mail),
    counterparty: relationCounterparty(type, mail),
    dateKey: toDateKey(mail.date),
    subject: mail.subject,
    seq: mail.seq ?? UNSEQUENCED_SORT_VALUE,
  };
}

/**
 * Порядок кандидатов — тот же, что у соседей в дереве (`compareEnds`): дата,
 * затем `seq`, затем ключ. Последний компонент делает порядок тотальным и не
 * зависит от порядка строк в ответе PocketBase.
 */
function compareCandidates(a: MailCandidate, b: MailCandidate): number {
  const byDate = (a.dateKey || '9999-12-31').localeCompare(b.dateKey || '9999-12-31');
  if (byDate !== 0) return byDate;
  const bySeq = a.seq - b.seq;
  if (bySeq !== 0) return bySeq;
  return a.key.localeCompare(b.key);
}

/**
 * Письма организации, сложенные в индекс кандидатов. Список строится целиком
 * по обоим регистрам: у входящего письма родитель ищется в исходящих и наоборот,
 * поэтому половинная выборка не дала бы индекса ни для одного из них.
 */
export function buildCandidateLookup(
  incoming: readonly IIncomingMail[],
  outgoing: readonly IOutgoingMail[],
): MailCandidateLookup {
  const byNumber: Record<MailType, Map<string, MailCandidate[]>> = {
    incoming: new Map(),
    outgoing: new Map(),
  };
  const byKey = new Map<MailNodeKey, MailCandidate>();
  const all: MailCandidate[] = [];

  for (const [type, mails] of [
    ['incoming', incoming],
    ['outgoing', outgoing],
  ] as const) {
    for (const mail of mails) {
      const candidate = toCandidate(type, mail);
      all.push(candidate);
      byKey.set(candidate.key, candidate);
      const folded = normalizeLinkNumber(candidate.number);
      if (!folded) continue;
      const bucket = byNumber[type].get(folded);
      if (bucket) {
        bucket.push(candidate);
      } else {
        byNumber[type].set(folded, [candidate]);
      }
    }
  }

  for (const type of ['incoming', 'outgoing'] as const) {
    for (const bucket of byNumber[type].values()) bucket.sort(compareCandidates);
  }

  return { byNumber, byKey, all };
}

/**
 * Письма, которые отвечают на введённый номер контрагента. Само письмо
 * исключается: связь с собой — это цикл длины один, а он, хоть и не
 * запрещён, не является ответом на другое письмо и нечего тут подтверждать.
 */
export function findParentCandidates(
  lookup: MailCandidateLookup,
  mailType: MailType,
  counterpartyNumber: string,
  selfKey: MailNodeKey | null,
): readonly MailCandidate[] {
  const folded = normalizeLinkNumber(counterpartyNumber);
  if (!folded) return [];
  const found = lookup.byNumber[PARENT_REGISTER_BY_TYPE[mailType]].get(folded) ?? [];
  if (!selfKey) return found;
  return found.filter((candidate) => candidate.key !== selfKey);
}

/**
 * Письмо по ключу. До загрузки org-wide выборки ответа нет — это не «нет
 * такого письма», а «ещё не знаем», и оба случая сводятся к отсутствию родителя,
 * потому что подтверждать всё равно нечего.
 */
export function candidateByKey(
  lookup: MailCandidateLookup | undefined,
  key: MailNodeKey | null,
): MailCandidate | null {
  if (!lookup || !key) return null;
  return lookup.byKey.get(key) ?? null;
}

/**
 * Подпись письма в списке выбора родителя: регистр, номер, контрагент и дата.
 *
 * Именно в этом порядке, потому что так человек ищет: сначала «входящее или
 * исходящее», потом номер, и лишь потом организация. Номер и контрагент
 * разделены точкой, а не тире, — в письмах оба встречаются с дефисами, и
 * слитная строка читалась бы как одно длинное слово.
 */
export function parentOptionLabel(candidate: MailCandidate): string {
  return [
    `${MAIL_REGISTER_BADGE_LABELS[candidate.type]} · № ${candidate.number || MAIL_EMPTY_CELL}`,
    candidate.counterparty || MAIL_EMPTY_CELL,
    formatMailDate(candidate.dateKey),
  ].join(' · ');
}

/**
 * Опции поля «Ответ на» — те же письма, что и в ручном подборе, но без поиска
 * по теме и в обратном порядке.
 *
 * Сначала письма организации обоих регистров, потому что письмо может отвечать
 * и на исходящее, и на входящее, — выбор не должен зависеть от открытой вкладки.
 * Само редактируемое письмо исключается тем же способом, что в `MailParentPicker`:
 * связь с собой не является ответом на другое письмо. Порядок — обратный
 * `compareCandidates`: в переписке ищут свежее, а не то, что было первым заведено.
 */
export function parentSelectOptions(
  lookup: MailCandidateLookup | undefined,
  selfKey: MailNodeKey | null,
): { value: string; label: string }[] {
  const all = lookup?.all ?? [];
  return [...all]
    .filter((candidate) => candidate.key !== selfKey)
    .sort(compareCandidates)
    .reverse()
    .map((candidate) => ({ value: candidate.key, label: parentOptionLabel(candidate) }));
}

/**
 * Что показывает номер контрагента. Ничего из этого не связывает письмо:
 * `empty` — номера нет и спрашивать не о чем; `none` — совпадений нет, письмо
 * остаётся началом цепочки; `single` — кандидат один и его надо подтвердить;
 * `collision` — кандидатов несколько и выбрать должен человек.
 */
export type ParentSuggestion =
  | { readonly kind: 'empty' }
  | { readonly kind: 'none' }
  | { readonly kind: 'single'; readonly parent: MailCandidate }
  | { readonly kind: 'collision'; readonly candidates: readonly MailCandidate[] };

/**
 * Кандидаты, на которые похож введённый номер контрагента. Ровно то, что
 * предлагает полоса под полем номера, и ничего сверх того: функция ничего не
 * знает ни о сохранённых связях, ни о праве пользователя.
 */
export function suggestParent(
  lookup: MailCandidateLookup | undefined,
  mailType: MailType,
  counterpartyNumber: string,
  selfKey: MailNodeKey | null,
): ParentSuggestion {
  if (!normalizeLinkNumber(counterpartyNumber)) return { kind: 'empty' };

  const candidates = lookup
    ? findParentCandidates(lookup, mailType, counterpartyNumber, selfKey)
    : [];
  if (candidates.length === 0) return { kind: 'none' };
  if (candidates.length === 1) return { kind: 'single', parent: candidates[0]! };
  return { kind: 'collision', candidates };
}

/**
 * Ответ человека на предложение по номеру. `pending` — предложение ещё не
 * рассматривалось, и оно показывается в полосе как есть; `picked` — родитель
 * назван (подтверждением предложения или выбором вручную); `declined` —
 * человек отказался, письмо остаётся началом цепочки.
 *
 * Отличие от прежнего `auto` — принципиальное: `pending` не означает «родитель
 * найден по номеру». Он означает «решения нет», и потому сохраняет то, что уже
 * записано в `mail_relations`.
 */
export type ParentIntent =
  | { readonly kind: 'pending' }
  | { readonly kind: 'picked'; readonly key: MailNodeKey }
  | { readonly kind: 'declined' };

export const PENDING_PARENT_INTENT: ParentIntent = { kind: 'pending' };

/**
 * Родитель, который будет записан при сохранении. `pending` — не решение, а
 * его отсутствие, поэтому возвращает уже сохранённого родителя; `declined` —
 * `null`, то есть письмо становится началом цепочки.
 *
 * Отвечает на вопрос «что человек решил», поэтому выбранный ключ проверяется
 * по индексу: письмо могли удалить, а выбор — остаться. Провалившийся выбор
 * тихо падает в «новую цепочку», а не в «связь с несуществующим письмом».
 */
export function intendedParentKey(
  intent: ParentIntent,
  savedParentKey: MailNodeKey | null,
): MailNodeKey | null {
  if (intent.kind === 'picked') return intent.key;
  if (intent.kind === 'declined') return null;
  return savedParentKey;
}

/**
 * `ребёнок → рёбра, где он ребёнок`. Именно эта сторона связи меняется, когда
 * человек заново называет родителя; родительские рёбра письма (оно само на
 * что-то отвечает) этого не касаются и остаются нетронутыми.
 */
export type ParentEdgeIndex = ReadonlyMap<MailNodeKey, readonly MailEdge[]>;

export function buildParentEdgeIndex(relations: readonly IMailRelation[]): ParentEdgeIndex {
  const index = new Map<MailNodeKey, MailEdge[]>();
  for (const relation of relations) {
    const edge = resolveRelationEdge(relation);
    if (!edge) continue;
    const bucket = index.get(edge.child.key);
    if (bucket) {
      bucket.push(edge);
    } else {
      index.set(edge.child.key, [edge]);
    }
  }
  return index;
}

export function parentEdgesOf(
  index: ParentEdgeIndex | undefined,
  key: MailNodeKey | null,
): readonly MailEdge[] {
  if (!index || !key) return [];
  return index.get(key) ?? [];
}

export type LinkChangePlan = {
  /** Связи, которые надо снять перед созданием новой. */
  readonly drop: readonly MailEdge[];
  /** Новый родитель целиком — `null` означает «письмо остаётся началом цепочки». */
  readonly create: MailCandidate | null;
};

/**
 * Что записать, когда человек заново назвал родителя. `null` означает «ничего
 * не трогать» — и это страховка от лишней записи, а не экономия запроса: если
 * единственный родитель остался тем же, снятие и создание той же связи дали бы
 * две лишние записи `unlinked`/`linked` в истории при неизменном результате.
 * Поэтому сравниваются ключи родителей, а не сам факт наличия связи.
 *
 * План не зависит от номера контрагента вообще: правка номера не пишет связь
 * и потому сюда не приводит.
 */
export function planLinkChange(
  existing: readonly MailEdge[],
  nextParent: MailCandidate | null,
): LinkChangePlan | null {
  const currentParents = new Set(existing.map((edge) => edge.parent.key));
  if (!nextParent && currentParents.size === 0) return null;
  if (nextParent && currentParents.size === 1 && currentParents.has(nextParent.key)) return null;
  return { drop: existing, create: nextParent };
}
