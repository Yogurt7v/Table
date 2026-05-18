export type ColumnSizingState = Record<string, number>;

const STORAGE_PREFIX = 'invoice-table-column-sizing:';

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
