import dayjs from 'dayjs';
import type { IInvoice } from '@/shared/types';

export function normalizePbDate(value: string): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function normalizeRelationId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

export function normalizeInvoice(record: IInvoice): IInvoice {
  return {
    ...record,
    date: normalizePbDate(record.date),
    paid_date: normalizePbDate(record.paid_date),
    accounting_object_id: normalizeRelationId(record.accounting_object_id),
    organization_id: normalizeRelationId(record.organization_id),
    seq: Number(record.seq) || 0,
    amount: Number(record.amount) || 0,
    paid: Boolean(record.paid),
  };
}

/** Фильтр PocketBase: все счета организации за календарный день. */
export function invoiceDateFilter(date: string): { start: string; end: string } {
  const start = normalizePbDate(date);
  const end = dayjs(start).add(1, 'day').format('YYYY-MM-DD');
  return { start, end };
}
