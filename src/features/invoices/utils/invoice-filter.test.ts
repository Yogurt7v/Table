import { describe, it, expect } from 'vitest';
import { matchesInvoiceFilter, filterInvoices } from './invoice-filter';
import type { IInvoice, IPaymentMark } from '@/shared/types';

function invoice(partial: Partial<IInvoice>): IInvoice {
  return {
    id: 'inv1',
    organization_id: 'org1',
    accounting_object_id: 'obj1',
    date: '2026-09-07',
    seq: 1,
    counterparty: 'Контрагент',
    purpose: 'Назначение',
    contract_no: '1',
    invoice_no: '1',
    amount: 10000,
    paid: false,
    paid_amount: null,
    payment_amounts: [],
    paid_date: '',
    comment: '',
    copy_comments: {},
    created_by: 'u1',
    updated_by: 'u1',
    ...partial,
  };
}

function mark(partial: Partial<IPaymentMark>): IPaymentMark {
  return {
    id: 'm1',
    invoice_id: 'inv1',
    organization_id: 'org1',
    amount: 10000,
    comment: '',
    created_by: 'u1',
    created: '2026-09-07',
    ...partial,
  };
}

describe('matchesInvoiceFilter', () => {
  it('matches paid for a fully paid invoice', () => {
    const inv = invoice({ paid: true, payment_amounts: [10000] });
    expect(matchesInvoiceFilter(inv, [], ['paid'])).toBe(true);
  });

  it('matches unpaid only when there are no payments', () => {
    expect(matchesInvoiceFilter(invoice({}), [], ['unpaid'])).toBe(true);
    expect(matchesInvoiceFilter(invoice({}), [], ['partial'])).toBe(false);
    expect(matchesInvoiceFilter(invoice({}), [], ['paid'])).toBe(false);
  });

  it('matches partial when partially paid', () => {
    const inv = invoice({ paid: false, payment_amounts: [4000] });
    expect(matchesInvoiceFilter(inv, [], ['partial'])).toBe(true);
    expect(matchesInvoiceFilter(inv, [], ['unpaid'])).toBe(false);
  });

  it('matches payment_mark only for kind payment', () => {
    const inv = invoice({ amount: 10000 });
    const approval = [mark({ status: 'proposed', amount: 10000 })];
    const payment = [mark({ status: 'approved', amount: 10000 })];
    expect(matchesInvoiceFilter(inv, payment, ['payment_mark'])).toBe(true);
    expect(matchesInvoiceFilter(inv, payment, ['approval_mark'])).toBe(false);
    expect(matchesInvoiceFilter(inv, approval, ['payment_mark'])).toBe(false);
    expect(matchesInvoiceFilter(inv, approval, ['approval_mark'])).toBe(true);
  });

  it('shows everything when no filters are active', () => {
    expect(matchesInvoiceFilter(invoice({}), [], [])).toBe(true);
    expect(matchesInvoiceFilter(invoice({ paid: true }), [], [])).toBe(true);
  });

  it('returns true when invoice matches any active filter', () => {
    const inv = invoice({ paid: true, payment_amounts: [10000] });
    expect(matchesInvoiceFilter(inv, [], ['unpaid', 'partial', 'paid'])).toBe(true);
  });
});

describe('filterInvoices', () => {
  const invoices = [
    invoice({ id: 'a', paid: true, payment_amounts: [10000] }),
    invoice({ id: 'b', paid: false }),
    invoice({ id: 'c', paid: false, payment_amounts: [3000] }),
  ];

  it('returns all invoices when no filters active', () => {
    expect(filterInvoices(invoices, [], [])).toHaveLength(3);
  });

  it('returns only unpaid', () => {
    expect(filterInvoices(invoices, [], ['unpaid']).map((i) => i.id)).toEqual(['b']);
  });

  it('returns paid', () => {
    expect(filterInvoices(invoices, [], ['paid']).map((i) => i.id)).toEqual(['a']);
  });

  it('returns partial', () => {
    expect(filterInvoices(invoices, [], ['partial']).map((i) => i.id)).toEqual(['c']);
  });

  it('handles undefined invoices', () => {
    expect(filterInvoices(undefined, [], [])).toEqual([]);
  });
});