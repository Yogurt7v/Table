import { describe, it, expect } from 'vitest';
import {
  canEditInvoiceField,
  getInvoicePermissions,
  validateDraftForm,
  createEmptyDraft,
} from './invoice-field-access';

describe('getInvoicePermissions', () => {
  it('guest is read-only', () => {
    expect(getInvoicePermissions('guest')).toEqual({
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canMove: false,
      canViewHistory: false,
      canMarkPayment: false,
      canViewPaymentMarks: false,
    });
  });

  it('user can create and update but not delete', () => {
    expect(getInvoicePermissions('user')).toMatchObject({
      canCreate: true,
      canUpdate: true,
      canDelete: false,
      canMove: false,
      canViewHistory: false,
      canMarkPayment: false,
      canViewPaymentMarks: false,
    });
  });

  it('admin has full UI permissions', () => {
    expect(getInvoicePermissions('admin')).toMatchObject({
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canMove: true,
      canViewHistory: true,
      canMarkPayment: false,
      canViewPaymentMarks: true,
    });
  });

  it('boss can mark payment and view marks', () => {
    expect(getInvoicePermissions('boss')).toMatchObject({
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canMove: false,
      canViewHistory: false,
      canMarkPayment: true,
      canViewPaymentMarks: true,
    });
  });

  it('moderator can view payment marks', () => {
    expect(getInvoicePermissions('moderator')).toMatchObject({
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canMove: true,
      canViewHistory: true,
      canMarkPayment: false,
      canViewPaymentMarks: true,
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
