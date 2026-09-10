import { describe, it, expect } from 'vitest';
import type { IInvoice } from '@/shared/types';
import { getEffectiveAmount, normalizeInvoiceForDate } from './invoice-utils';

const baseInvoice: IInvoice = {
  id: 'inv1',
  organization_id: 'org1',
  accounting_object_id: 'obj1',
  date: '2026-09-01',
  seq: 1,
  counterparty: 'Ип Лосев',
  purpose: 'работы',
  contract_no: '',
  invoice_no: '34',
  amount: 40000,
  paid: true,
  paid_amount: 10000,
  payment_amounts: [10000],
  paid_date: '2026-09-02',
  comment: '',
  copy_comments: {},
  created_by: 'u1',
  updated_by: 'u1',
  original_invoice_id: undefined,
  source_paid_amount: 0,
  source_paid_date: '',
};

describe('getEffectiveAmount', () => {
  it('paid invoice shows total paid amount', () => {
    expect(getEffectiveAmount(baseInvoice)).toBe(10000);
  });

  it('unpaid invoice shows base amount', () => {
    expect(getEffectiveAmount({ ...baseInvoice, paid: false, payment_amounts: [] })).toBe(40000);
  });
});

describe('normalizeInvoiceForDate', () => {
  it('returns invoice unchanged when not paid', () => {
    const unpaid = { ...baseInvoice, paid: false, paid_date: '' };
    expect(normalizeInvoiceForDate(unpaid, '2026-09-01')).toBe(unpaid);
  });

  it('returns invoice unchanged when paid before or on the viewed date', () => {
    expect(normalizeInvoiceForDate(baseInvoice, '2026-09-03')).toBe(baseInvoice);
    expect(normalizeInvoiceForDate(baseInvoice, '2026-09-02')).toBe(baseInvoice);
  });

  it('shows future-paid invoice as unpaid with full amount', () => {
    const result = normalizeInvoiceForDate(baseInvoice, '2026-09-01');
    expect(result.paid).toBe(false);
    expect(result.paid_date).toBe('');
    expect(result.paid_amount).toBeNull();
    expect(result.payment_amounts).toEqual([]);
    expect(result.amount).toBe(40000);
    expect(result.id).toBe('inv1');
  });

  it('does not mutate the original invoice', () => {
    const original = { ...baseInvoice };
    normalizeInvoiceForDate(baseInvoice, '2026-09-01');
    expect(original).toEqual(baseInvoice);
  });
});