import { describe, it, expect } from 'vitest';
import { buildInvoiceDelta } from './build-invoice-delta';
import type { DraftInvoiceForm } from '../invoice-field-access';
import type { IInvoice } from '@/shared/types';

const mockInvoice: IInvoice = {
  id: 'inv1',
  organization_id: 'org1',
  accounting_object_id: 'ao1',
  date: '2026-06-01',
  seq: 1,
  counterparty: 'ООО "Тест"',
  purpose: 'Оплата услуг',
  contract_no: 'Д-001',
  invoice_no: 'СФ-001',
  amount: 50000,
  paid: false,
  paid_amount: null,
  payment_amounts: [],
  paid_date: '',
  comment: '',
  created_by: 'u1',
  updated_by: 'u1',
  created_by_name: 'Иван Петров',
  copy_comments: {},
  source_paid_amount: 0,
  source_paid_date: '',
};

function formMatchingInvoice(invoice: IInvoice): DraftInvoiceForm {
  return {
    counterparty: invoice.counterparty,
    purpose: invoice.purpose,
    contract_no: invoice.contract_no,
    invoice_no: invoice.invoice_no,
    amount: invoice.amount,
    paid: invoice.paid,
    paid_date: invoice.paid_date ?? '',
    comment: invoice.comment ?? '',
    initiator: invoice.created_by ?? '',
    file: null,
  };
}

describe('buildInvoiceDelta initiator', () => {
  it('records created_by and created_by_name when initiator changes', () => {
    const data = { ...formMatchingInvoice(mockInvoice), initiator: 'u2' };
    const delta = buildInvoiceDelta(data, mockInvoice, '2026-06-01', (id) => (id === 'u2' ? 'Анна' : ''));

    expect(delta.changed).toBe(true);
    expect(delta.updates.created_by).toBe('u2');
    expect(delta.updates.created_by_name).toBe('Анна');
    expect(delta.previousData.created_by).toBe('u1');
    expect(delta.previousData.created_by_name).toBe('Иван Петров');
  });

  it('does not record initiator when unchanged', () => {
    const data = formMatchingInvoice(mockInvoice);
    const delta = buildInvoiceDelta(data, mockInvoice, '2026-06-01');

    expect(delta.changed).toBe(false);
    expect(delta.updates.created_by).toBeUndefined();
  });

  it('never clears an existing initiator to empty', () => {
    const data = { ...formMatchingInvoice(mockInvoice), initiator: '' };
    const delta = buildInvoiceDelta(data, mockInvoice, '2026-06-01');

    expect(delta.updates.created_by).toBeUndefined();
    expect(delta.updates.created_by_name).toBeUndefined();
  });

  it('resolves empty created_by to a real user', () => {
    const invoiceWithoutInitiator = { ...mockInvoice, created_by: '', created_by_name: '' };
    const data = { ...formMatchingInvoice(invoiceWithoutInitiator), initiator: 'u2' };
    const delta = buildInvoiceDelta(data, invoiceWithoutInitiator, '2026-06-01', () => 'Анна');

    expect(delta.changed).toBe(true);
    expect(delta.updates.created_by).toBe('u2');
    expect(delta.updates.created_by_name).toBe('Анна');
    expect(delta.previousData.created_by).toBe('');
  });
});