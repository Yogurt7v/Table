import { MAIL_WEIGHT_BY_ID } from './mail-columns';
import type { MailColumnId } from './mail-columns';

/**
 * Ширина колонки реестра писем. Единица хранения — доля ширины таблицы в
 * процентах, а не пиксели: `mail-columns.ts` задаёт веса именно потому, что
 * сумма пикселей выталкивала таблицу за пределы `Paper` под
 * `table-layout: fixed`. Держать ручную ширину в пикселях значило бы вернуть
 * ровно тот риск, поэтому граница колонки переводит движение мыши в ту же
 * единицу, что и базовые веса, и инвариант «сумма ровно 100%» сохраняется
 * структурно, а не дисциплиной.
 */

export type ColumnSizingState = Record<string, number>;

const STORAGE_PREFIX = 'mail-table-column-sizing:';

export const TOTAL_SHARE = 100;

/**
 * Доля, которую нельзя отдать одной колонке: пока есть свободные колонки, они
 * сохраняют хотя бы десятую часть ширины, иначе растянутая «Тема» съела бы
 * остальные в ноль, а колонка нулевой ширины хуже узкой.
 */
const SHARE_RESERVED_FOR_FREE = 10;

export function clampShare(share: number): number {
  return Math.min(Math.max(share, 0), TOTAL_SHARE - SHARE_RESERVED_FOR_FREE);
}

function storageKey(orgId: string) {
  return `${STORAGE_PREFIX}${orgId}`;
}

export function loadColumnSizing(orgId: string): ColumnSizingState {
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const result: ColumnSizingState = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function saveColumnSizing(orgId: string, sizing: ColumnSizingState) {
  try {
    localStorage.setItem(storageKey(orgId), JSON.stringify(sizing));
  } catch {
    // ignore quota / private mode errors
  }
}

/**
 * Доли видимых колонок в процентах ширины таблицы; сумма ровно 100.
 *
 * Ручная ширина забирает свою долю, остаток свободные колонки делят по весам —
 * поэтому «Тема», растянутая мышью, не выдавливает «Дату» за пределы таблицы.
 * Знаменатель здесь — сумма весов ИМЕННО ВИДИМЫХ колонок, а не всех двенадцати:
 * спрятанная колонка не должна оставлять за собой пустую долю, иначе таблица
 * перестаёт занимать свою ширину целиком.
 *
 * Если сохранённые доли в сумме больше допустимого (старый или битый
 * `localStorage`), они масштабируются пропорционально: сумма долей выше 100%
 * привела бы к переполнению по той же причине, что и сумма пикселей.
 */
export function resolveColumnShares(
  visibleIds: readonly MailColumnId[],
  overrides: ColumnSizingState,
): Map<MailColumnId, number> {
  const shares = new Map<MailColumnId, number>();
  if (visibleIds.length === 0) return shares;

  const pinned: { id: MailColumnId; share: number }[] = [];
  const free: MailColumnId[] = [];
  for (const id of visibleIds) {
    const override = overrides[id];
    if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
      pinned.push({ id, share: clampShare(override) });
    } else {
      free.push(id);
    }
  }

  const ceiling = TOTAL_SHARE - (free.length > 0 ? SHARE_RESERVED_FOR_FREE : 0);
  const requested = pinned.reduce((sum, entry) => sum + entry.share, 0);
  const scale = requested > ceiling && requested > 0 ? ceiling / requested : 1;

  let pinnedTotal = 0;
  for (const entry of pinned) {
    const share = entry.share * scale;
    shares.set(entry.id, share);
    pinnedTotal += share;
  }

  const remaining = TOTAL_SHARE - pinnedTotal;
  const freeWeightSum = free.reduce((sum, id) => sum + MAIL_WEIGHT_BY_ID[id], 0);
  for (const id of free) {
    shares.set(id, (remaining * MAIL_WEIGHT_BY_ID[id]) / freeWeightSum);
  }
  return shares;
}
