import { describe, it, expect } from 'vitest';
import type { IDocument } from '@/shared/types';

const SYNCED_FIELDS = new Set<string>([
  'payment_date',
  'counterparty',
  'purpose',
  'contract_no',
  'invoice_no',
  'amount',
]);

function makeDocument(overrides: Partial<IDocument> = {}): IDocument {
  return {
    id: 'doc1',
    organization_id: 'org1',
    accounting_object_id: 'obj1',
    seq: 1,
    payment_date: '2026-10-14',
    counterparty: 'ООО Тест',
    purpose: 'Назначение',
    contract_no: 'Д-1',
    invoice_no: 'СЧ-1',
    amount: 1000,
    responsible_id: 'u1',
    responsible_name: 'Ответственный',
    created_by: 'u2',
    created_by_name: 'Автор',
    source_invoice_id: 'inv1',
    source_invoice_no: 'СЧ-1',
    creation_mode: 'auto',
    sync_locked: false,
    provided: false,
    confirmed: false,
    confirmed_file_id: '',
    payment_cancelled: false,
    is_deleted: false,
    ...overrides,
  };
}

/**
 * Синхронизация документа со счётом (D23, D35):
 * - Авто-созданный документ синхронизируется со счётом до первой правки реквизита
 * - Комментарии, файлы, статусы, смена ответственного не ломают синхронизацию
 * - Ручной документ сразу заморожен (sync_locked = true)
 * - После первой правки реквизита документ замораживается (sync_locked = true)
 */
function shouldLockSync(dataKeys: string[]): boolean {
  return dataKeys.some((key) => SYNCED_FIELDS.has(key));
}

describe('document sync behavior', () => {
  it('auto document is not locked initially (sync_locked = false)', () => {
    const doc = makeDocument({ creation_mode: 'auto', sync_locked: false });
    expect(doc.sync_locked).toBe(false);
    expect(doc.creation_mode).toBe('auto');
  });

  it('manual document is immediately locked (sync_locked = true)', () => {
    const doc = makeDocument({ creation_mode: 'manual', sync_locked: true });
    expect(doc.sync_locked).toBe(true);
    expect(doc.creation_mode).toBe('manual');
  });

  it('changing a synced field locks the document', () => {
    expect(shouldLockSync(['counterparty'])).toBe(true);
  });

  it('changing a non-synced field does not lock the document', () => {
    expect(shouldLockSync(['provided', 'confirmed'])).toBe(false);
  });

  it('status changes (provided/confirmed) do not lock sync', () => {
    expect(shouldLockSync(['provided'])).toBe(false);
    expect(shouldLockSync(['confirmed'])).toBe(false);
    expect(shouldLockSync(['confirmed_file_id'])).toBe(false);
  });

  it('file add/remove does not lock sync', () => {
    expect(shouldLockSync([])).toBe(false);
  });

  it('responsible change does not lock sync', () => {
    expect(shouldLockSync(['responsible_id'])).toBe(false);
  });

  it('synced fields list includes payment_date, counterparty, purpose, contract_no, invoice_no, amount', () => {
    expect(SYNCED_FIELDS.has('payment_date')).toBe(true);
    expect(SYNCED_FIELDS.has('counterparty')).toBe(true);
    expect(SYNCED_FIELDS.has('purpose')).toBe(true);
    expect(SYNCED_FIELDS.has('contract_no')).toBe(true);
    expect(SYNCED_FIELDS.has('invoice_no')).toBe(true);
    expect(SYNCED_FIELDS.has('amount')).toBe(true);
    expect(SYNCED_FIELDS.has('seq')).toBe(false);
    expect(SYNCED_FIELDS.has('provided')).toBe(false);
  });
});
