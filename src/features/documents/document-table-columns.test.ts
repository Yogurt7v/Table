import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_DOCUMENT_COLUMNS,
  DOCUMENT_COLUMNS,
  getDocumentColumnWidth,
  isDocumentCompleted,
  loadDocumentColumns,
  loadDocumentColumnSizing,
  saveDocumentColumnSizing,
  saveDocumentColumns,
} from './document-columns';
import type { DocumentColumnId } from '@/shared/types';

describe('document table columns', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns all columns in default order', () => {
    expect(DEFAULT_DOCUMENT_COLUMNS).toEqual(DOCUMENT_COLUMNS.map((c) => c.id));
    expect(DEFAULT_DOCUMENT_COLUMNS).toEqual([
      'seq',
      'payment_date',
      'counterparty',
      'purpose',
      'contract_no',
      'invoice_no',
      'amount',
      'responsible',
      'author',
      'provided',
      'confirmed',
      'files',
      'comments',
      'source_file',
    ]);
  });

  it('round-trips visible columns via localStorage', () => {
    const columns = ['seq', 'counterparty', 'amount'] as DocumentColumnId[];
    saveDocumentColumns('org1', [...columns]);
    expect(loadDocumentColumns('org1')).toEqual(columns);
  });

  it('returns defaults for invalid JSON', () => {
    localStorage.setItem('document-table-columns:org1', 'not-json');
    expect(loadDocumentColumns('org1')).toEqual(DEFAULT_DOCUMENT_COLUMNS);
  });

  it('ignores unknown column ids and falls back to defaults when all are unknown', () => {
    localStorage.setItem('document-table-columns:org1', JSON.stringify(['unknown', 'also-unknown']));
    expect(loadDocumentColumns('org1')).toEqual(DEFAULT_DOCUMENT_COLUMNS);
  });

  it('round-trips column sizing via localStorage', () => {
    const sizing = { seq: 80, counterparty: 260 };
    saveDocumentColumnSizing('org1', sizing);
    expect(loadDocumentColumnSizing('org1')).toEqual(sizing);
  });

  it('ignores non-numeric or non-finite sizing values', () => {
    localStorage.setItem(
      'document-table-column-sizing:org1',
      '{"seq":80,"counterparty":"wide","amount":null,"purpose":1e999}',
    );
    expect(loadDocumentColumnSizing('org1')).toEqual({ seq: 80 });
  });

  it('uses separate keys per organization', () => {
    saveDocumentColumns('org-a', ['seq']);
    saveDocumentColumns('org-b', ['amount']);
    expect(loadDocumentColumns('org-a')).toEqual(['seq']);
    expect(loadDocumentColumns('org-b')).toEqual(['amount']);
  });

  it('uses stored width when present', () => {
    const column = DOCUMENT_COLUMNS.find((item) => item.id === 'counterparty')!;
    expect(getDocumentColumnWidth(column, { counterparty: 300 })).toBe(300);
    expect(getDocumentColumnWidth(column, {})).toBe(column.width);
  });

  it('marks a document completed only when both statuses are true', () => {
    const makeDoc = (overrides: Record<string, unknown> = {}) => ({
      id: 'doc1',
      organization_id: 'org1',
      accounting_object_id: 'obj1',
      seq: 1,
      payment_date: '2026-10-14',
      counterparty: 'ООО Тест',
      purpose: '',
      contract_no: '',
      invoice_no: '',
      amount: 0,
      responsible_id: 'u1',
      created_by: 'u1',
      creation_mode: 'auto' as const,
      sync_locked: false,
      provided: false,
      confirmed: false,
      payment_cancelled: false,
      is_deleted: false,
      ...overrides,
    });
    expect(isDocumentCompleted(makeDoc())).toBe(false);
    expect(isDocumentCompleted(makeDoc({ provided: true }))).toBe(false);
    expect(isDocumentCompleted(makeDoc({ confirmed: true }))).toBe(false);
    expect(isDocumentCompleted(makeDoc({ provided: true, confirmed: true }))).toBe(true);
  });
});
