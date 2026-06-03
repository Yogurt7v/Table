import { describe, it, expect } from 'vitest';
import {
  getInvoicePaymentInfo,
  createPaymentCopyInvoices,
  createRemainderInvoice,
  filterPaidInvoiceForRemainder,
} from './expand-invoice-rows';
import type { IInvoice } from '@/shared/types';

const baseInvoice: IInvoice = {
  id: 'inv1', organization_id: 'org1', accounting_object_id: 'ao1',
  date: '2026-06-01', seq: 1, counterparty: 'ООО "Тест"',
  purpose: 'Оплата услуг', contract_no: 'Д-001', invoice_no: 'СФ-001',
  amount: 50000, paid: false, paid_amount: null, payment_amounts: [],
  paid_date: '', comment: '', created_by: 'admin1', updated_by: 'admin1',
};

describe('getInvoicePaymentInfo', () => {
  it('returns zeros when no payments', () => {
    const info = getInvoicePaymentInfo(baseInvoice);
    expect(info).toEqual({
      amounts: [], totalPaid: 0, remaining: 50000,
      hasCopies: false, hasRemainder: false,
    });
  });

  it('returns single payment info', () => {
    const info = getInvoicePaymentInfo({ ...baseInvoice, payment_amounts: [30000] });
    expect(info).toEqual({
      amounts: [30000], totalPaid: 30000, remaining: 20000,
      hasCopies: false, hasRemainder: true,
    });
  });

  it('returns full payment info', () => {
    const info = getInvoicePaymentInfo({ ...baseInvoice, payment_amounts: [50000] });
    expect(info).toEqual({
      amounts: [50000], totalPaid: 50000, remaining: 0,
      hasCopies: false, hasRemainder: false,
    });
  });

  it('returns multiple payments info', () => {
    const info = getInvoicePaymentInfo({ ...baseInvoice, payment_amounts: [10000, 20000, 15000] });
    expect(info).toEqual({
      amounts: [10000, 20000, 15000], totalPaid: 45000, remaining: 5000,
      hasCopies: true, hasRemainder: true,
    });
  });
});

describe('createPaymentCopyInvoices', () => {
  it('returns empty array when only one payment', () => {
    const copies = createPaymentCopyInvoices({ ...baseInvoice, payment_amounts: [30000] });
    expect(copies).toEqual([]);
  });

  it('returns one copy for two payments', () => {
    const copies = createPaymentCopyInvoices({ ...baseInvoice, payment_amounts: [10000, 25000] });
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({
      id: 'inv1__p0', amount: 25000, paid: true,
      paid_amount: null, payment_amounts: [], paid_date: null,
    });
  });

  it('returns copies for each extra payment', () => {
    const copies = createPaymentCopyInvoices({ ...baseInvoice, payment_amounts: [5000, 10000, 15000] });
    expect(copies).toHaveLength(2);
    expect(copies[0]).toMatchObject({ id: 'inv1__p0', amount: 10000, paid: true });
    expect(copies[1]).toMatchObject({ id: 'inv1__p1', amount: 15000, paid: true });
  });
});

describe('createRemainderInvoice', () => {
  it('returns null when invoice is unpaid', () => {
    expect(createRemainderInvoice({ ...baseInvoice, payment_amounts: [] })).toBeNull();
  });

  it('returns null when fully paid', () => {
    expect(createRemainderInvoice({ ...baseInvoice, payment_amounts: [50000] })).toBeNull();
  });

  it('returns remainder invoice when partially paid', () => {
    const remainder = createRemainderInvoice({ ...baseInvoice, payment_amounts: [30000] });
    expect(remainder).not.toBeNull();
    expect(remainder).toMatchObject({
      id: 'inv1__r', amount: 20000, paid: false,
      paid_amount: null, payment_amounts: [], paid_date: null,
    });
  });
});

describe('filterPaidInvoiceForRemainder', () => {
  it('returns invoice as-is when unpaid', () => {
    const result = filterPaidInvoiceForRemainder(baseInvoice);
    expect(result).toBe(baseInvoice);
  });

  it('returns null when paid with no payment amounts', () => {
    const result = filterPaidInvoiceForRemainder({
      ...baseInvoice, paid: true, payment_amounts: [],
    });
    expect(result).toBeNull();
  });

  it('returns null when paid in full', () => {
    const result = filterPaidInvoiceForRemainder({
      ...baseInvoice, paid: true, payment_amounts: [50000],
    });
    expect(result).toBeNull();
  });

  it('returns remainder when paid partially', () => {
    const result = filterPaidInvoiceForRemainder({
      ...baseInvoice, paid: true, payment_amounts: [30000],
    });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      amount: 20000, paid: false,
      paid_amount: null, payment_amounts: [], paid_date: null,
    });
  });

  it('returns remainder keeping original id', () => {
    const result = filterPaidInvoiceForRemainder({
      ...baseInvoice, paid: true, payment_amounts: [30000],
    });
    expect(result!.id).toBe('inv1');
  });
});
