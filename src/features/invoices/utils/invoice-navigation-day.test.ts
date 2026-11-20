import { describe, expect, it } from 'vitest';
import { resolveInvoiceNavigationDay } from './invoice-navigation-day';
import type { IInvoice } from '@/shared/types';

const baseInvoice: IInvoice = {
  id: 'inv1',
  organization_id: 'org1',
  accounting_object_id: 'ao1',
  date: '2026-06-01',
  seq: 1,
  counterparty: 'ООО "Тест"',
  purpose: 'Оплата работ',
  contract_no: 'Д-1',
  invoice_no: 'СФ-001',
  amount: 50000,
  paid: true,
  paid_amount: 50000,
  payment_amounts: [50000],
  paid_date: '2026-06-02',
  comment: '',
  copy_comments: {},
  created_by: 'admin1',
  updated_by: 'admin1',
  source_paid_amount: 50000,
  source_paid_date: '2026-06-02',
};

describe('resolveInvoiceNavigationDay', () => {
  it('возвращает день оплаты, когда он есть и разрешён к просмотру', () => {
    expect(resolveInvoiceNavigationDay(baseInvoice, true)).toBe('2026-06-02');
  });

  it('возвращает день счёта, когда дата оплаты пустая', () => {
    expect(resolveInvoiceNavigationDay({ ...baseInvoice, paid_date: '' }, true)).toBe('2026-06-01');
  });

  it('возвращает день счёта, когда дата оплаты скрыта от пользователя', () => {
    expect(resolveInvoiceNavigationDay(baseInvoice, false)).toBe('2026-06-01');
  });

  it('нормализует ISO-строку с временем до YYYY-MM-DD', () => {
    expect(
      resolveInvoiceNavigationDay({ ...baseInvoice, paid_date: '2026-06-02 00:00:00.000Z' }, true),
    ).toBe('2026-06-02');
  });
});
