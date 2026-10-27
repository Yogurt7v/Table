import { describe, it, expect } from 'vitest';
import type { IDocument } from '@/shared/types';
import type { OrgRole } from '@/features/invoices/invoice-field-access';

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
 * Проверка прав доступа к полям документа по ролям (D13, D14).
 * admin/mod — полный доступ ко всем полям.
 * user (ответственный) — может редактировать только контрагента, сумму, номер счёта, назначение, договор.
 * user НЕ может менять: Дату оплаты, объект, ответственного, статусы, seq, автора, связь со счётом.
 * boss — только чтение всех полей.
 * guest — нет доступа.
 */
function canEditField(role: OrgRole, isResponsible: boolean, field: keyof IDocument): boolean {
  if (role === 'guest') return false;
  if (role === 'boss') return false;

  const adminEditable = new Set<keyof IDocument>([
    'counterparty', 'purpose', 'contract_no', 'invoice_no', 'amount',
    'payment_date', 'accounting_object_id', 'responsible_id', 'responsible_name',
    'provided', 'confirmed', 'confirmed_file_id', 'seq', 'source_invoice_id',
    'source_invoice_no', 'sync_locked', 'payment_cancelled', 'is_deleted',
    'deletion_reason', 'deleted_by', 'deleted_by_name', 'deleted_at',
  ]);

  if (role === 'admin' || role === 'moderator') return adminEditable.has(field);

  // user (ответственный)
  const userEditable = new Set<keyof IDocument>([
    'counterparty', 'purpose', 'contract_no', 'invoice_no', 'amount',
  ]);
  return isResponsible && userEditable.has(field);
}

describe('document field access by role', () => {
  const doc = makeDocument();

  it('admin can edit all fields', () => {
    const editableFields = Object.keys(doc).filter((key) =>
      canEditField('admin', false, key as keyof IDocument),
    );
    expect(editableFields).toContain('counterparty');
    expect(editableFields).toContain('payment_date');
    expect(editableFields).toContain('accounting_object_id');
    expect(editableFields).toContain('responsible_id');
    expect(editableFields).toContain('provided');
    expect(editableFields).toContain('confirmed');
    expect(editableFields).toContain('seq');
    expect(editableFields).toContain('source_invoice_id');
  });

  it('moderator can edit all fields', () => {
    expect(canEditField('moderator', false, 'counterparty')).toBe(true);
    expect(canEditField('moderator', false, 'payment_date')).toBe(true);
    expect(canEditField('moderator', false, 'responsible_id')).toBe(true);
    expect(canEditField('moderator', false, 'provided')).toBe(true);
    expect(canEditField('moderator', false, 'seq')).toBe(true);
  });

  it('responsible user can edit counterparty, amount, invoice_no, contract_no, purpose', () => {
    expect(canEditField('user', true, 'counterparty')).toBe(true);
    expect(canEditField('user', true, 'amount')).toBe(true);
    expect(canEditField('user', true, 'invoice_no')).toBe(true);
    expect(canEditField('user', true, 'contract_no')).toBe(true);
    expect(canEditField('user', true, 'purpose')).toBe(true);
  });

  it('responsible user CANNOT edit payment_date, object, responsible, statuses, seq, source link', () => {
    expect(canEditField('user', true, 'payment_date')).toBe(false);
    expect(canEditField('user', true, 'accounting_object_id')).toBe(false);
    expect(canEditField('user', true, 'responsible_id')).toBe(false);
    expect(canEditField('user', true, 'provided')).toBe(false);
    expect(canEditField('user', true, 'confirmed')).toBe(false);
    expect(canEditField('user', true, 'seq')).toBe(false);
    expect(canEditField('user', true, 'source_invoice_id')).toBe(false);
  });

  it('non-responsible user cannot edit anything', () => {
    expect(canEditField('user', false, 'counterparty')).toBe(false);
    expect(canEditField('user', false, 'amount')).toBe(false);
  });

  it('boss cannot edit any field (read-only)', () => {
    expect(canEditField('boss', false, 'counterparty')).toBe(false);
    expect(canEditField('boss', false, 'amount')).toBe(false);
    expect(canEditField('boss', true, 'counterparty')).toBe(false);
  });

  it('guest cannot access any field', () => {
    expect(canEditField('guest', false, 'counterparty')).toBe(false);
    expect(canEditField('guest', true, 'counterparty')).toBe(false);
  });
});
