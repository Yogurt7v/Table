import type { DocumentColumnId, IDocument } from '@/shared/types';

export interface DocumentColumnDefinition {
  id: DocumentColumnId;
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

export const DOCUMENT_COLUMNS: DocumentColumnDefinition[] = [
  { id: 'seq', label: '№', width: 64, align: 'center' },
  { id: 'payment_date', label: 'Дата оплаты', width: 116, align: 'center' },
  { id: 'counterparty', label: 'Контрагент', width: 240 },
  { id: 'purpose', label: 'Назначение', width: 260 },
  { id: 'contract_no', label: 'Договор', width: 120 },
  { id: 'invoice_no', label: 'Счёт №', width: 120 },
  { id: 'amount', label: 'Сумма', width: 128, align: 'right' },
  { id: 'responsible', label: 'Ответственный', width: 180 },
  { id: 'author', label: 'Автор', width: 160 },
  { id: 'provided', label: 'Предоставлен', width: 128, align: 'center' },
  { id: 'confirmed', label: 'Подтверждён', width: 128, align: 'center' },
  { id: 'files', label: 'Файлы', width: 76, align: 'center' },
  { id: 'comments', label: 'Комментарии', width: 110, align: 'center' },
  { id: 'source_file', label: 'Файл счёта', width: 120, align: 'center' },
];

export const DEFAULT_DOCUMENT_COLUMNS: DocumentColumnId[] = DOCUMENT_COLUMNS.map(
  (column) => column.id,
);

const VISIBLE_PREFIX = 'document-table-columns:';
const WIDTH_PREFIX = 'document-table-column-sizing:';

export type DocumentColumnSizing = Record<string, number>;

export function isDocumentCompleted(document: IDocument): boolean {
  return document.provided && document.confirmed;
}

export function loadDocumentColumns(orgId: string): DocumentColumnId[] {
  try {
    const raw = localStorage.getItem(`${VISIBLE_PREFIX}${orgId}`);
    if (!raw) return DEFAULT_DOCUMENT_COLUMNS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_DOCUMENT_COLUMNS;
    const known = new Set(DEFAULT_DOCUMENT_COLUMNS);
    const result = parsed.filter((id): id is DocumentColumnId => known.has(id));
    return result.length > 0 ? result : DEFAULT_DOCUMENT_COLUMNS;
  } catch {
    return DEFAULT_DOCUMENT_COLUMNS;
  }
}

export function saveDocumentColumns(orgId: string, columns: DocumentColumnId[]) {
  try {
    localStorage.setItem(`${VISIBLE_PREFIX}${orgId}`, JSON.stringify(columns));
  } catch {
    // ignore storage errors
  }
}

export function loadDocumentColumnSizing(orgId: string): DocumentColumnSizing {
  try {
    const raw = localStorage.getItem(`${WIDTH_PREFIX}${orgId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const result: DocumentColumnSizing = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveDocumentColumnSizing(orgId: string, sizing: DocumentColumnSizing) {
  try {
    localStorage.setItem(`${WIDTH_PREFIX}${orgId}`, JSON.stringify(sizing));
  } catch {
    // ignore storage errors
  }
}

export function getDocumentColumnWidth(
  column: DocumentColumnDefinition,
  sizing: DocumentColumnSizing,
): number {
  return sizing[column.id] ?? column.width;
}
