import { describe, it, expect } from 'vitest';
import {
  canEditInvoiceField,
  getInvoicePermissions,
  validateDraftForm,
  createEmptyDraft,
  isDraftDirty,
} from './invoice-field-access';

describe('getInvoicePermissions', () => {
  it('guest is read-only', () => {
    expect(getInvoicePermissions('guest')).toEqual({
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canMove: false,
      canViewHistory: false,
      canManageFiles: false,
      canPay: false,
      canMarkPayment: false,
      canViewPaymentMarks: false,
      canViewPaidDate: true,
    });
  });

  it('user can create and update but not delete', () => {
    expect(getInvoicePermissions('user')).toMatchObject({
      canCreate: true,
      canUpdate: true,
      canDelete: false,
      canMove: false,
      canViewHistory: false,
      canManageFiles: true,
      canPay: false,
      canMarkPayment: false,
      canViewPaymentMarks: false,
      canViewPaidDate: true,
    });
  });

  it('admin has full UI permissions', () => {
    expect(getInvoicePermissions('admin')).toMatchObject({
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canMove: true,
      canViewHistory: true,
      canManageFiles: true,
      canPay: true,
      canMarkPayment: false,
      canViewPaymentMarks: true,
      canViewPaidDate: true,
    });
  });

  it('boss can mark payment, view marks, but hide paid_date', () => {
    expect(getInvoicePermissions('boss')).toMatchObject({
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canMove: false,
      canViewHistory: false,
      canManageFiles: false,
      canPay: false,
      canMarkPayment: true,
      canViewPaymentMarks: true,
      canViewPaidDate: false,
    });
  });

  it('moderator can view payment marks', () => {
    expect(getInvoicePermissions('moderator')).toMatchObject({
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canMove: true,
      canViewHistory: true,
      canManageFiles: true,
      canPay: true,
      canMarkPayment: false,
      canViewPaymentMarks: true,
      canViewPaidDate: true,
    });
  });
});

describe('canEditInvoiceField', () => {
  it('user cannot edit paid fields', () => {
    expect(canEditInvoiceField('user', 'paid')).toBe(false);
    expect(canEditInvoiceField('user', 'paid_date')).toBe(false);
    expect(canEditInvoiceField('user', 'counterparty')).toBe(true);
  });

  it('moderator can edit paid fields', () => {
    expect(canEditInvoiceField('moderator', 'paid')).toBe(true);
    expect(canEditInvoiceField('moderator', 'amount')).toBe(true);
  });
});

describe('validateDraftForm', () => {
  it('requires main fields', () => {
    expect(validateDraftForm(createEmptyDraft())).toBeTruthy();
    const valid = {
      ...createEmptyDraft(),
      counterparty: 'ООО Тест',
      purpose: 'Оплата',
      invoice_no: '123',
      amount: 1000,
    };
    expect(validateDraftForm(valid)).toBeNull();
  });

  it('accepts amount with kopecks', () => {
    const valid = {
      ...createEmptyDraft(),
      counterparty: 'ООО Тест',
      purpose: 'Оплата',
      invoice_no: '123',
      amount: 100.55,
    };
    expect(validateDraftForm(valid)).toBeNull();
  });
});

describe('isDraftDirty', () => {
  it('empty draft is clean', () => {
    expect(isDraftDirty(createEmptyDraft())).toBe(false);
  });

  it('any filled text field makes it dirty', () => {
    expect(isDraftDirty({ ...createEmptyDraft(), counterparty: 'ООО' })).toBe(true);
    expect(isDraftDirty({ ...createEmptyDraft(), purpose: 'Оплата' })).toBe(true);
    expect(isDraftDirty({ ...createEmptyDraft(), contract_no: '1' })).toBe(true);
    expect(isDraftDirty({ ...createEmptyDraft(), invoice_no: '5' })).toBe(true);
    expect(isDraftDirty({ ...createEmptyDraft(), comment: 'заметка' })).toBe(true);
  });

  it('non-zero numeric amount makes it dirty', () => {
    expect(isDraftDirty({ ...createEmptyDraft(), amount: 100 })).toBe(true);
  });

  it('string amount from NumberInput is handled, including comma decimal', () => {
    const asUnknown = (v: unknown) => v as number;
    expect(isDraftDirty({ ...createEmptyDraft(), amount: asUnknown('12,5') })).toBe(true);
    expect(isDraftDirty({ ...createEmptyDraft(), amount: asUnknown('0') })).toBe(false);
  });

  it('attached file makes it dirty', () => {
    const file = new File(['x'], 'scan.pdf');
    expect(isDraftDirty({ ...createEmptyDraft(), file })).toBe(true);
  });
});
