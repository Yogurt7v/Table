import { describe, it, expect } from 'vitest';
import { groupInvoicesByCounterparty } from './group-invoices';
import type { IInvoice } from '@/shared/types';

function inv(partial: Partial<IInvoice> & Pick<IInvoice, 'id' | 'counterparty'>): IInvoice {
  return {
    id: partial.id,
    organization_id: 'org1',
    accounting_object_id: 'ao1',
    date: '2026-09-01',
    seq: 0,
    counterparty: partial.counterparty,
    purpose: '',
    contract_no: '',
    invoice_no: '',
    amount: 0,
    paid: false,
    paid_amount: null,
    payment_amounts: [],
    paid_date: '',
    comment: '',
    created_by: 'u1',
    updated_by: 'u1',
    ...partial,
  };
}

describe('groupInvoicesByCounterparty', () => {
  it('сортирует внутри группы по created (моменту добавления)', () => {
    const invoices = [
      inv({ id: 'a', counterparty: 'Ромашка', created: '2026-09-01 10:00:00' }),
      inv({ id: 'b', counterparty: 'Ромашка', created: '2026-09-01 08:00:00' }),
      inv({ id: 'c', counterparty: 'Ромашка', created: '2026-09-01 09:00:00' }),
    ];

    const groups = groupInvoicesByCounterparty(invoices);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.invoices.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('порядок групп — по первому появлению контрагента (min created)', () => {
    const invoices = [
      inv({ id: 'a', counterparty: 'Ромашка', created: '2026-09-01 09:00:00' }),
      inv({ id: 'b', counterparty: 'Иванов', created: '2026-09-01 07:00:00' }),
      inv({ id: 'c', counterparty: 'Петров', created: '2026-09-01 10:00:00' }),
    ];

    const groups = groupInvoicesByCounterparty(invoices);
    expect(groups.map((g) => g.counterparty)).toEqual(['Иванов', 'Ромашка', 'Петров']);
  });

  it('копии частичной оплаты ставятся сразу после оригинала', () => {
    const invoices = [
      inv({
        id: 'orig',
        counterparty: 'Ромашка',
        created: '2026-09-01 09:00:00',
      }),
      inv({
        id: 'other',
        counterparty: 'Ромашка',
        created: '2026-09-01 11:00:00',
      }),
      inv({
        id: 'copy',
        counterparty: 'Ромашка',
        created: '2026-09-01 15:00:00',
        original_invoice_id: 'orig',
      }),
    ];

    const groups = groupInvoicesByCounterparty(invoices);
    expect(groups[0]!.invoices.map((i) => i.id)).toEqual(['orig', 'copy', 'other']);
  });

  it('цепочка копий идёт сразу за корневым оригиналом', () => {
    const invoices = [
      inv({ id: 'orig', counterparty: 'Ромашка', created: '2026-09-01 09:00:00' }),
      inv({
        id: 'copy1',
        counterparty: 'Ромашка',
        created: '2026-09-01 16:00:00',
        original_invoice_id: 'orig',
      }),
      inv({
        id: 'copy2',
        counterparty: 'Ромашка',
        created: '2026-09-01 17:00:00',
        original_invoice_id: 'copy1',
      }),
    ];

    const groups = groupInvoicesByCounterparty(invoices);
    expect(groups[0]!.invoices.map((i) => i.id)).toEqual(['orig', 'copy1', 'copy2']);
  });

  it('сирота-копия занимает место корня через source_created', () => {
    const invoices = [
      inv({
        id: 'early',
        counterparty: 'Ромашка',
        created: '2026-09-01 08:00:00',
      }),
      inv({
        id: 'copy',
        counterparty: 'Ромашка',
        created: '2026-09-01 15:00:00',
        source_created: '2026-09-01 09:30:00',
        original_invoice_id: 'orig-not-in-selection',
      }),
    ];

    const groups = groupInvoicesByCounterparty(invoices);
    expect(groups[0]!.invoices.map((i) => i.id)).toEqual(['early', 'copy']);
  });

  it('без created счета остаются в исходном порядке', () => {
    const invoices = [
      inv({ id: 'a', counterparty: 'Ромашка' }),
      inv({ id: 'b', counterparty: 'Ромашка' }),
    ];

    const groups = groupInvoicesByCounterparty(invoices);
    expect(groups[0]!.invoices.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('allInvoices сохраняют стабильный порядок групп при скрытии счетов', () => {
    // Иванов (07:00) скрыт, но группа Ромашка (09:00) стоит раньше Петрова (10:00),
    // т.к. порядок берётся из полного списка allInvoices
    const all = [
      inv({ id: 'a', counterparty: 'Ромашка', created: '2026-09-01 09:00:00' }),
      inv({ id: 'b', counterparty: 'Иванов', created: '2026-09-01 07:00:00' }),
      inv({ id: 'c', counterparty: 'Петров', created: '2026-09-01 10:00:00' }),
    ];
    const visible = [all[0]!, all[2]!];

    const groups = groupInvoicesByCounterparty(visible, all);
    expect(groups.map((g) => g.counterparty)).toEqual(['Ромашка', 'Петров']);
    expect(groups.map((g) => g.invoices.map((i) => i.id))).toEqual([
      ['a'],
      ['c'],
    ]);
  });

  it('counterpartyOrder определяет порядок групп, новые контрагенты — в конец', () => {
    const invoices = [
      inv({ id: 'a', counterparty: 'Ромашка', created: '2026-09-01 09:00:00' }),
      inv({ id: 'b', counterparty: 'Иванов', created: '2026-09-01 07:00:00' }),
      inv({ id: 'c', counterparty: 'Петров', created: '2026-09-01 10:00:00' }),
      inv({ id: 'd', counterparty: 'Сидоров', created: '2026-09-01 11:00:00' }),
    ];

    const groups = groupInvoicesByCounterparty(invoices, undefined, [
      'Петров',
      'Ромашка',
    ]);
    expect(groups.map((g) => g.counterparty)).toEqual([
      'Петров',
      'Ромашка',
      'Иванов',
      'Сидоров',
    ]);
  });

  it('counterpartyOrder не ломает порядок внутри группы', () => {
    const invoices = [
      inv({ id: 'a', counterparty: 'Ромашка', created: '2026-09-01 09:00:00' }),
      inv({ id: 'b', counterparty: 'Ромашка', created: '2026-09-01 08:00:00' }),
      inv({ id: 'c', counterparty: 'Петров', created: '2026-09-01 10:00:00' }),
    ];

    const groups = groupInvoicesByCounterparty(invoices, undefined, ['Петров', 'Ромашка']);
    expect(groups.map((g) => g.counterparty)).toEqual(['Петров', 'Ромашка']);
    expect(groups[1]!.invoices.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('counterpartyOrder с неизвестными контрагентами игнорирует их', () => {
    const invoices = [
      inv({ id: 'a', counterparty: 'Ромашка', created: '2026-09-01 09:00:00' }),
      inv({ id: 'b', counterparty: 'Петров', created: '2026-09-01 10:00:00' }),
    ];

    const groups = groupInvoicesByCounterparty(invoices, undefined, [
      'Несуществующий',
      'Петров',
      'Ромашка',
    ]);
    expect(groups.map((g) => g.counterparty)).toEqual(['Петров', 'Ромашка']);
  });
});