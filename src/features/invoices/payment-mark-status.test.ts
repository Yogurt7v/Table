import { describe, it, expect } from 'vitest';
import { getPaymentMarkKind, paymentMarkLabel } from './payment-mark-status';
import type { IPaymentMark } from '@/shared/types';

function mark(partial: Partial<IPaymentMark>): IPaymentMark {
  return {
    id: 'pm1', invoice_id: 'inv1', organization_id: 'org1',
    amount: null, comment: '', status: undefined, created_by: 'admin1', created: '2026-06-02',
    ...partial,
  };
}

describe('getPaymentMarkKind', () => {
  it('treats proposed as approval regardless of amount', () => {
    expect(getPaymentMarkKind(mark({ status: 'proposed', amount: 50000 }), 50000)).toBe('approval');
  });

  it('treats partial status as partial', () => {
    expect(getPaymentMarkKind(mark({ status: 'partial', amount: 30000 }), 50000)).toBe('partial');
  });

  it('treats approved as payment when amount equals invoice amount', () => {
    expect(getPaymentMarkKind(mark({ status: 'approved', amount: 50000 }), 50000)).toBe('payment');
  });

  it('falls back to payment for legacy mark without status and full amount', () => {
    expect(getPaymentMarkKind(mark({ amount: 50000 }), 50000)).toBe('payment');
  });

  it('falls back to partial for legacy mark with smaller amount', () => {
    expect(getPaymentMarkKind(mark({ amount: 30000 }), 50000)).toBe('partial');
  });

  it('falls back to partial for legacy mark without amount', () => {
    expect(getPaymentMarkKind(mark({ amount: null }), 50000)).toBe('partial');
  });
});

describe('paymentMarkLabel', () => {
  it('returns «Согласование» for approval', () => {
    expect(paymentMarkLabel(mark({ status: 'proposed' }), 50000)).toBe('Согласование');
  });

  it('returns «Частично» for partial', () => {
    expect(paymentMarkLabel(mark({ status: 'partial' }), 50000)).toBe('Частично');
  });

  it('returns «Оплатить» for full payment', () => {
    expect(paymentMarkLabel(mark({ status: 'approved', amount: 50000 }), 50000)).toBe('Оплатить');
  });
});