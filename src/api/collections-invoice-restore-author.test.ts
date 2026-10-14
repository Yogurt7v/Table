import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pb } from '@/api/client';
import { restoreDeletedInvoice } from './collections';

/**
 * Регрессия: восстановленный счёт сохраняет ИСХОДНОГО автора.
 *
 * Клиент шлёт в `create` не автора, а ССЫЛКУ на архивную запись
 * (`restored_from_invoice_id`); настоящего автора сервер достаёт из архива сам.
 *
 * Почему именно так, а не «клиент пришлёт `created_by`, хук не будет трогать»:
 * второй вариант открывает подделку авторства — любой аутентифицированный
 * пользователь создал бы счёт от чужого имени. Хук в `pb_hooks/notify.pb.js`
 * обязан продолжать перезаписывать присланный `created_by`, поэтому клиент и не
 * отправляет его вовсе. Проверено на живом PocketBase: подложенный
 * `created_by` от чужого id приходит в базу как id восстановителя.
 *
 * Проверять тут нечем, кроме «клиент не назначает автора сам»: итогового
 * `created_by` у клиента нет, он появляется только после ответа сервера. Вся
 * серверная часть (резолв из архива + фолбэк на восстановителя при пустом
 * архивном авторе) проверяется на живом PocketBase, а не здесь.
 *
 * Мок — тот же шов, что в `collections-payment-mark-actor.test.ts`: хук над
 * `@/api/client`, `getOne`/`create`/`delete`/`getFullList`.
 */

type Payload = Record<string, unknown>;

const h = vi.hoisted(() => ({
  auth: { model: null as { id: string; name: string; email: string } | null },
  rows: new Map<string, unknown>(),
  creates: new Map<string, Payload[]>(),
  deletes: [] as string[],
}));

vi.mock('@/api/client', () => {
  const collection = (name: string) => ({
    getOne: (id: string) => {
      const found = h.rows.get(`${name}/${id}`);
      if (found === undefined) throw new Error(`stub: нет записи ${name}/${id}`);
      return Promise.resolve(found);
    },
    getFullList: () => Promise.resolve([]),
    create: (body: Payload) => {
      const log = h.creates.get(name) ?? [];
      log.push(body);
      h.creates.set(name, log);
      return Promise.resolve({
        id: `inv_${log.length}`,
        organization_id: body['organization_id'] ?? '',
        date: body['date'] ?? '',
        seq: 1,
        counterparty: body['counterparty'] ?? '',
        amount: body['amount'] ?? 0,
        paid: false,
        paid_amount: 0,
        comment: '',
        ...body,
      });
    },
    delete: (id: string) => {
      h.deletes.push(id);
      return Promise.resolve(true);
    },
    subscribe: () => Promise.resolve(() => {}),
    unsubscribe: () => Promise.resolve(),
  });

  return {
    pb: {
      authStore: {
        get model() {
          return h.auth.model;
        },
        clear: () => {
          h.auth.model = null;
        },
      },
      collection,
      files: { getURL: () => '' },
    },
  };
});

const RESTORER: { id: string; name: string; email: string } = {
  id: 'user02restore',
  name: 'Пётр',
  email: 'petr@example.com',
};

function archived(overrides: Payload = {}): Payload {
  return {
    id: 'del01hxyz',
    original_id: 'inv01hxyz',
    organization_id: 'org01hxyz',
    accounting_object_id: 'obj01hxyz',
    date: '2024-03-01',
    seq: 3,
    counterparty: 'ООО Ромашка',
    purpose: 'Оплата',
    contract_no: 'Д-1',
    invoice_no: 'СЧ-1',
    amount: 1000,
    paid: false,
    paid_date: '',
    paid_amount: 0,
    payment_amounts: [],
    comment: 'Удалено 2024-04-01 — причина',
    // Счёт, созданный анонимно ДО миграции 1815000013: автор — пустая строка.
    created_by: '',
    created_by_name: '',
    updated_by: '',
    updated_by_name: '',
    original_invoice_id: '',
    deleted_by: 'user02restore',
    deleted_by_name: 'Пётр',
    deleted_at: '2024-04-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Тело create('invoices'); бросает, если счёт вообще не создавался. */
function createdInvoice(): Payload {
  const body = h.creates.get('invoices')?.[0];
  if (body === undefined) {
    throw new Error('stub: не было create(invoices)');
  }
  return body;
}

beforeEach(() => {
  h.rows = new Map();
  h.creates = new Map();
  h.deletes = [];
  h.auth.model = RESTORER;
});

afterEach(() => {
  pb.authStore.clear();
});

describe('restoreDeletedInvoice — автор восстановления решает сервер', () => {
  it('в create уходит ссылка на архивную запись', async () => {
    h.rows.set('deleted_invoices/del01hxyz', archived());

    await restoreDeletedInvoice('del01hxyz');

    expect(createdInvoice()['restored_from_invoice_id']).toBe('del01hxyz');
  });

  it('архивный автор НЕ отправляется: сервер затёр бы его в любом случае', async () => {
    h.rows.set(
      'deleted_invoices/del01hxyz',
      archived({ created_by: 'user09legacy', created_by_name: 'Автор' }),
    );

    await restoreDeletedInvoice('del01hxyz');

    const body = createdInvoice();
    expect(body['created_by']).toBeUndefined();
    expect(body['created_by_name']).toBeUndefined();
  });

  it('пустой архивный автор тоже не отправляется — фолбэк живёт в хуке', async () => {
    h.rows.set('deleted_invoices/del01hxyz', archived());

    await restoreDeletedInvoice('del01hxyz');

    expect(createdInvoice()['created_by']).toBeUndefined();
    expect(createdInvoice()['restored_from_invoice_id']).toBe('del01hxyz');
  });

  it('ссылка берётся из id, который восстановили, а не из original_id архива', async () => {
    h.rows.set('deleted_invoices/del01hxyz', archived({ original_id: 'inv01hxyz' }));

    await restoreDeletedInvoice('del01hxyz');

    // `original_id` — это id удалённого счёта, а хук ищет по нему запись
    // архива. Спутать их — значит отправить несуществующую ссылку.
    expect(createdInvoice()['restored_from_invoice_id']).not.toBe('inv01hxyz');
  });

  it('архивная запись удаляется после восстановления', async () => {
    h.rows.set('deleted_invoices/del01hxyz', archived());

    await restoreDeletedInvoice('del01hxyz');

    expect(h.deletes).toContain('del01hxyz');
  });
});
