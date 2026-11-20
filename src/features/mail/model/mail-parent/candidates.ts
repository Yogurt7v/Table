/** Индекс кандидатов на родителя: нормализация, поиск, подписи и опции выбора. */

import type { IIncomingMail, IOutgoingMail, MailType } from '@/shared/types';
import { foldSearchText } from '@/shared/utils/search-text';
import { formatMailDate, toDateKey } from '../mail-date';
import { MAIL_EMPTY_CELL, MAIL_REGISTER_BADGE_LABELS } from '../mail-labels';
import { relationCounterparty, relationNumber } from '../mail-relations';
import { mailNodeKey } from '../mail-thread';
import type { MailNodeKey } from '../mail-thread';
import {
  PARENT_REGISTER_BY_TYPE,
  type MailCandidate,
  type MailCandidateLookup,
  type ParentSuggestion,
} from './types';

/**
 * Номер для сопоставления: обрезанные края, схлопнутые пробелы и схлопнутые
 * невидимые символы, регистр. Пустая строка после свёртки означает «номера нет»
 * и никогда ни с чем не совпадает.
 */
export function normalizeLinkNumber(value: string | null | undefined): string {
  return foldSearchText(value ?? '');
}

const UNSEQUENCED_SORT_VALUE = Number.MAX_SAFE_INTEGER;

/** Преобразует письмо регистра в запись-кандидата с полями для поиска и отображения. */
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
