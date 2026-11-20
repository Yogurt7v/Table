/** Типы, константы и маркеры для подсказок и выбора родителя письма. */

import type { MailType } from '@/shared/types';
import type { MailEdge, MailNodeKey } from '../mail-thread';

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

/** Намерение «решения ещё нет» — по умолчанию сохраняет уже записанную связь. */
export const PENDING_PARENT_INTENT: ParentIntent = { kind: 'pending' };

/**
 * `ребёнок → рёбра, где он ребёнок`. Именно эта сторона связи меняется, когда
 * человек заново называет родителя; родительские рёбра письма (оно само на
 * что-то отвечает) этого не касаются и остаются нетронутыми.
 */
export type ParentEdgeIndex = ReadonlyMap<MailNodeKey, readonly MailEdge[]>;

/** План изменения связи: какие рёбра снять и какого родителя создать. */
export type LinkChangePlan = {
  /** Связи, которые надо снять перед созданием новой. */
  readonly drop: readonly MailEdge[];
  /** Новый родитель целиком — `null` означает «письмо остаётся началом цепочки». */
  readonly create: MailCandidate | null;
};
