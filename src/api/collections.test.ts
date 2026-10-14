import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDeletedInvoice, IInvoice } from '@/shared/types';
import { deleteInvoice, restoreDeletedInvoice } from './collections';

type Payload = Record<string, unknown>;

/** Что именно ушло в `create()` — единственное, что тесты реально проверяют. */
interface Stub {
  /** Ответ на `getOne()` по ключу `коллекция/id`. */
  one: Map<string, unknown>;
  /** Ответ на `getFullList()` по имени коллекции. */
  list: Map<string, unknown[]>;
  /** Все тела `create()` по имени коллекции, в порядке вызовов. */
  creates: Map<string, Payload[]>;
  /** Все id, ушедшие в `delete()`, в формате `коллекция/id`. */
  deletes: string[];
}

const h = vi.hoisted(() => ({
  stub: {
    one: new Map(),
    list: new Map(),
    creates: new Map(),
    deletes: [],
  } as Stub,
}));

vi.mock('@/api/client', () => {
  const record = (name: string) => {
    const created = `${name}_new`;
    return {
      getOne: (id: string) => {
        const found = h.stub.one.get(`${name}/${id}`);
        if (found === undefined) throw new Error(`stub: нет записи ${name}/${id}`);
        return Promise.resolve(found);
      },
      getFullList: () => Promise.resolve(h.stub.list.get(name) ?? []),
      create: (body: Payload) => {
        const log = h.stub.creates.get(name) ?? [];
        log.push(body);
        h.stub.creates.set(name, log);
        return Promise.resolve({ id: created, ...body });
      },
      update: (id: string, body: Payload) => Promise.resolve({ id, ...body }),
      delete: (id: string) => {
        h.stub.deletes.push(`${name}/${id}`);
        return Promise.resolve(true);
      },
      unsubscribe: () => Promise.resolve(),
    };
  };

  return {
    pb: {
      authStore: { model: { id: 'u1', name: 'Модератор', email: 'mod@example.com' } },
      collection: record,
    },
  };
});

function putOne(collection: string, id: string, value: unknown) {
  h.stub.one.set(`${collection}/${id}`, value);
}

function createdComment(collection: string, index = 0): string {
  const log = h.stub.creates.get(collection);
  const body = log?.[index];
  if (body === undefined) throw new Error(`stub: не было create(${collection})[${index}]`);
  const comment = body['comment'];
  if (typeof comment !== 'string') {
    throw new Error(
      `stub: create(${collection})[${index}].comment — не строка (${typeof comment})`,
    );
  }
  return comment;
}

function invoiceFixture(overrides: Partial<IInvoice> = {}): IInvoice {
  return {
    id: 'inv1',
    organization_id: 'org1',
    accounting_object_id: 'obj1',
    date: '2026-10-14',
    seq: 7,
    counterparty: 'ООО Ромашка',
    purpose: 'Поставка картофеля',
    contract_no: 'Д-12',
    invoice_no: 'СЧ-77',
    amount: 1200,
    paid: false,
    paid_amount: null,
    payment_amounts: [],
    paid_date: '',
    comment: '',
    copy_comments: {},
    created_by: 'u1',
    updated_by: 'u1',
    source_paid_amount: 0,
    source_paid_date: '',
    ...overrides,
  };
}

function deletedFixture(overrides: Partial<IDeletedInvoice> = {}): IDeletedInvoice {
  return {
    id: 'del1',
    original_id: 'inv1',
    organization_id: 'org1',
    accounting_object_id: 'obj1',
    date: '2026-10-14',
    seq: 7,
    counterparty: 'ООО Ромашка',
    purpose: 'Поставка картофеля',
    contract_no: 'Д-12',
    invoice_no: 'СЧ-77',
    amount: 1200,
    paid: false,
    paid_date: '',
    paid_amount: null,
    payment_amounts: [],
    comment: '',
    copy_comments: {},
    created_by: 'u1',
    updated_by: 'u1',
    created_by_name: 'Модератор',
    updated_by_name: 'Модератор',
    original_invoice_id: '',
    source_paid_amount: 0,
    source_paid_date: '',
    source_created: '',
    deleted_by: 'u1',
    deleted_by_name: 'Модератор',
    deleted_at: '2026-10-14T10:00:00.000Z',
    created: '2026-10-01T09:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  h.stub.one = new Map();
  h.stub.list = new Map();
  h.stub.creates = new Map();
  h.stub.deletes = [];
  h.stub.list.set('invoice_history', []);
  h.stub.list.set('invoice_files', []);
  h.stub.list.set('deleted_invoice_history', []);
  h.stub.list.set('deleted_invoice_files', []);
});

describe('deleteInvoice', () => {
  it('дописывает причину в комментарий архивной записи отдельной строкой', async () => {
    putOne('invoices', 'inv1', invoiceFixture({ comment: 'первая строка' }));

    await deleteInvoice('inv1', 'дубль');

    expect(createdComment('deleted_invoices')).toBe('первая строка\nпричина удаления: дубль');
  });

  it('счёт без комментария архивируется с одной лишь строкой причины', async () => {
    putOne('invoices', 'inv1', invoiceFixture({ comment: '' }));

    await deleteInvoice('inv1', 'дубль');

    expect(createdComment('deleted_invoices')).toBe('причина удаления: дубль');
  });

  it('причина не попадает в живую строку счёта — она физически удаляется', async () => {
    putOne('invoices', 'inv1', invoiceFixture({ comment: 'первая строка' }));

    await deleteInvoice('inv1', 'дубль');

    expect(h.stub.creates.has('invoices')).toBe(false);
    expect(h.stub.deletes).toContain('invoices/inv1');
  });

  it('причина остаётся только в архиве: в историю удаления она не пишется', async () => {
    putOne('invoices', 'inv1', invoiceFixture({ comment: 'первая строка' }));

    await deleteInvoice('inv1', 'дубль');

    const log = h.stub.creates.get('deleted_invoice_history');
    expect(log).toBeDefined();
    expect(JSON.stringify(log)).not.toContain('причина удаления');
  });

  it('остальные поля архивной записи копируются без изменений', async () => {
    putOne(
      'invoices',
      'inv1',
      invoiceFixture({ comment: 'первая строка', invoice_no: 'СЧ-77', amount: 1200 }),
    );

    await deleteInvoice('inv1', 'дубль');

    const body = h.stub.creates.get('deleted_invoices')?.[0];
    expect(body?.['invoice_no']).toBe('СЧ-77');
    expect(body?.['amount']).toBe(1200);
    expect(body?.['original_id']).toBe('inv1');
  });
});

describe('restoreDeletedInvoice', () => {
  it('срезает хвостовую строку причины, комментарий возвращается исходным', async () => {
    putOne(
      'deleted_invoices',
      'del1',
      deletedFixture({ comment: 'первая строка\nпричина удаления: дубль' }),
    );

    await restoreDeletedInvoice('del1');

    expect(createdComment('invoices')).toBe('первая строка');
  });

  it('архив без причины восстанавливается с комментарием как есть', async () => {
    putOne('deleted_invoices', 'del1', deletedFixture({ comment: 'первая строка' }));

    await restoreDeletedInvoice('del1');

    expect(createdComment('invoices')).toBe('первая строка');
  });

  it('архив, где комментарий — только причина, восстанавливается с пустым комментарием', async () => {
    putOne('deleted_invoices', 'del1', deletedFixture({ comment: 'причина удаления: дубль' }));

    await restoreDeletedInvoice('del1');

    expect(createdComment('invoices')).toBe('');
  });

  it('многострочный архивный комментарий теряет только последнюю строку', async () => {
    putOne(
      'deleted_invoices',
      'del1',
      deletedFixture({ comment: 'раз\nдва\nпричина удаления: оплата не прошла' }),
    );

    await restoreDeletedInvoice('del1');

    expect(createdComment('invoices')).toBe('раз\nдва');
  });

  it('восстановленный счёт затем удаляется из архива', async () => {
    putOne('deleted_invoices', 'del1', deletedFixture({ comment: 'причина удаления: дубль' }));

    await restoreDeletedInvoice('del1');

    expect(h.stub.deletes).toContain('deleted_invoices/del1');
  });
});

describe('deleteInvoice → restoreDeletedInvoice', () => {
  it('причина не всплывает обратно в восстановленный счёт', async () => {
    putOne('invoices', 'inv1', invoiceFixture({ comment: 'первая строка' }));

    await deleteInvoice('inv1', 'дубль');

    // Архивная запись создана сервером — берём её комментарий как есть и
    // отдаём в восстановление, не подменяя.
    const archived = deletedFixture({
      comment: createdComment('deleted_invoices'),
    });
    putOne('deleted_invoices', 'del1', archived);

    await restoreDeletedInvoice('del1');

    expect(createdComment('invoices')).toBe('первая строка');
  });
});
