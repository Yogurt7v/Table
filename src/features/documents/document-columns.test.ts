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
import type { IDocument } from '@/shared/types';

function makeDocument(overrides: Partial<IDocument> = {}): IDocument {
  return {
    id: 'doc1',
    organization_id: 'org1',
    accounting_object_id: 'obj1',
    seq: 1,
    payment_date: '2026-10-14',
    counterparty: 'ООО Тест',
    purpose: 'Назначение',
    contract_no: '',
    invoice_no: 'СЧ-1',
    amount: 1000,
    responsible_id: 'u1',
    created_by: 'u1',
    creation_mode: 'auto',
    sync_locked: false,
    provided: false,
    confirmed: false,
    payment_cancelled: false,
    is_deleted: false,
    ...overrides,
  };
}

describe('document-columns', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default columns when nothing is stored', () => {
    expect(loadDocumentColumns('org1')).toEqual(DEFAULT_DOCUMENT_COLUMNS);
  });

  it('round-trips visible columns via localStorage', () => {
    const columns = ['seq', 'counterparty', 'amount'] as const;
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
    localStorage.setItem('document-table-column-sizing:org1', '{"seq":80,"counterparty":"wide","amount":null,"purpose":1e999}');
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
    expect(isDocumentCompleted(makeDocument())).toBe(false);
    expect(isDocumentCompleted(makeDocument({ provided: true }))).toBe(false);
    expect(isDocumentCompleted(makeDocument({ confirmed: true }))).toBe(false);
    expect(isDocumentCompleted(makeDocument({ provided: true, confirmed: true }))).toBe(true);
  });
});
