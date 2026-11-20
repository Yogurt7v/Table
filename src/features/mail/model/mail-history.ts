import type { IMailHistory, MailHistoryType } from '@/shared/types';
import { MAIL_HISTORY_HIDDEN_FIELDS } from './mail-labels';
import { formatMailDate, formatMailTimestampSeconds } from './mail-date';

/**
 * Разбор `mail_history` в список записей для модалки истории.
 *
 * Формат хранения тот же, что у `invoice_history`: `previous_data` — снимок
 * полей ДО изменения, а «после» восстанавливается из следующей, более свежей
 * записи. Так же считает диффы `InvoiceHistoryModal` — иначе «старое → новое»
 * на соседних экранах читалось бы по-разному.
 *
 * У самой свежей правки следующей записи нет, и «после» для неё — это текущее
 * состояние письма (`currentMail`). Без него новое значение терялось бы, а
 * правка «пусто → значение» не отличалась бы от «пусто → пусто» и пропадала
 * бы вовсе (оба конца рисуются прочерком).
 */

export interface MailHistoryDiff {
  key: string;
  from: unknown;
  to: unknown;
}

export interface MailHistoryEntry {
  entryId: string;
  changedAt: string;
  author: string;
  type: MailHistoryType;
  previousData: Record<string, unknown>;
  diffs: MailHistoryDiff[];
}

export function parsePreviousData(data: unknown): Record<string, unknown> {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>;
  return {};
}

export function formatDiffValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Ключ-календарный день: `date` письма — сутки, а не момент (см. `mail-date.ts`). */
const DATE_ONLY_FIELDS = new Set(['date']);

/**
 * Значение диффа так, как его прочтёт человек. Строки даты и времени
 * форматируются: в `previous_data` они лежат в формате PocketBase
 * (`2026-10-09 00:00:00.000Z`), и в ленте это не читается.
 *
 * `date` печатается календарным днём (первые 10 символов), а момент
 * (`*_at`) — с временем и секундами: у них разный смысл, и один формат
 * для обоих сдвинул бы письмо на сутки в западных таймзонах.
 */
export function formatMailHistoryValue(key: string, value: unknown): string {
  if (typeof value === 'string' && value) {
    if (DATE_ONLY_FIELDS.has(key)) {
      const day = formatMailDate(value);
      if (day) return day;
    } else if (key.endsWith('_at')) {
      const moment = formatMailTimestampSeconds(value);
      if (moment) return moment;
    }
  }
  return formatDiffValue(value);
}

export function buildMailHistoryEntries(
  history: IMailHistory[],
  currentMail?: Record<string, unknown> | null,
): MailHistoryEntry[] {
  if (history.length === 0) return [];

  const ascending = [...history].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
  );

  const entries: MailHistoryEntry[] = [];

  for (let i = 0; i < ascending.length; i += 1) {
    const entry = ascending[i]!;
    const previousData = parsePreviousData(entry.previous_data);
    const nextPrevious = ascending[i + 1]
      ? parsePreviousData(ascending[i + 1]!.previous_data)
      : null;

    const diffs: MailHistoryDiff[] = [];
    if (entry.type === 'updated') {
      for (const [key, value] of Object.entries(previousData)) {
        if (MAIL_HISTORY_HIDDEN_FIELDS.has(key)) continue;
        let to: unknown = null;
        if (nextPrevious && key in nextPrevious) {
          to = nextPrevious[key];
        } else if (!nextPrevious && currentMail && key in currentMail) {
          to = currentMail[key];
        }
        if (formatDiffValue(value) === formatDiffValue(to)) continue;
        diffs.push({ key, from: value, to });
      }
    }

    entries.push({
      entryId: entry.id,
      changedAt: entry.changed_at,
      author: entry.author_name || entry.author || '—',
      type: entry.type,
      previousData,
      diffs,
    });
  }

  return entries.reverse();
}
