import { describe, it, expect } from 'vitest';
import type { IInvoice } from '@/shared/types';
import {
  normalizePbDate,
  normalizeRelationId,
  normalizeInvoice,
  invoiceDateFilter,
} from './normalize-invoice';

describe('normalizePbDate', () => {
  it('strips time from PocketBase datetime', () => {
    expect(normalizePbDate('2026-05-18 00:00:00.000Z')).toBe('2026-05-18');
    expect(normalizePbDate('2026-05-18')).toBe('2026-05-18');
  });
});

describe('normalizeRelationId', () => {
  it('extracts id from relation object', () => {
    expect(normalizeRelationId('abc123')).toBe('abc123');
    expect(normalizeRelationId({ id: 'obj1' })).toBe('obj1');
  });
});

describe('invoiceDateFilter', () => {
  it('returns day range for filter', () => {
    expect(invoiceDateFilter('2026-05-18')).toEqual({
      start: '2026-05-18',
      end: '2026-05-19',
    });
  });
});

describe('normalizeInvoice', () => {
  it('normalizes date, relations, and numbers', () => {
    const result = normalizeInvoice({
      id: '1',
      organization_id: { id: 'org1' } as unknown as string,
      accounting_object_id: { id: 'obj1' } as unknown as string,
      date: '2026-05-18 00:00:00.000Z',
      seq: '2' as unknown as number,
      counterparty: 'A',
      purpose: 'B',
      contract_no: '',
      invoice_no: '1',
      amount: '100.5' as unknown as number,
      paid: 0 as unknown as boolean,
      paid_amount: null,
      payment_amounts: [],
      paid_date: '',
      comment: '',
    });
    expect(result.date).toBe('2026-05-18');
    expect(result.accounting_object_id).toBe('obj1');
    expect(result.seq).toBe(2);
    expect(result.amount).toBe(100.5);
    expect(result.paid_amount).toBeNull();
    expect(result.payment_amounts).toEqual([]);
  });

  it('normalizes paid_amount and payment_amounts', () => {
    const full = normalizeInvoice({
      id: '1',
      organization_id: 'org1',
      accounting_object_id: 'obj1',
      date: '2026-05-18',
      seq: 1,
      counterparty: 'A',
      purpose: 'B',
      contract_no: '',
      invoice_no: '1',
      amount: 100,
      paid: true,
      paid_amount: null,
      payment_amounts: [100],
      paid_date: '2026-05-18',
      comment: '',
    });
    expect(full.paid_amount).toBeNull();
    expect(full.payment_amounts).toEqual([100]);

    const partial = normalizeInvoice({
      id: '2',
      organization_id: 'org1',
      accounting_object_id: 'obj1',
      date: '2026-05-18',
      seq: 2,
      counterparty: 'A',
      purpose: 'B',
      contract_no: '',
      invoice_no: '2',
      amount: 100,
      paid: true,
      paid_amount: 60 as unknown as number,
      payment_amounts: [60],
      paid_date: '2026-05-18',
      comment: '',
    });
    expect(partial.paid_amount).toBe(60);
    expect(partial.payment_amounts).toEqual([60]);
  });

  it('normalizes missing payment_amounts to empty array', () => {
    const result = normalizeInvoice({
      id: '3',
      organization_id: 'org1',
      accounting_object_id: 'obj1',
      date: '2026-05-18',
      seq: 3,
      counterparty: 'A',
      purpose: 'B',
      contract_no: '',
      invoice_no: '3',
      amount: 100,
      paid: false,
      paid_amount: null,
      paid_date: '',
      comment: '',
    } as unknown as IInvoice);
    expect(result.payment_amounts).toEqual([]);
  });
});
