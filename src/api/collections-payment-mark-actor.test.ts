import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IUser } from '@/shared/types';
import { setLastKnownUser } from '@/shared/auth/last-known-user';
import { pb } from '@/api/client';
import { createPaymentMark, approvePaymentMark } from './collections';

/**
 * Регрессия: `payment_marks.created_by` — relation на `users`, и писать его
 * надо из id пользователя. `pb.authStore.model` обнуляется мгновенно на
 * просроченном токене (ветка 401 в `pb.afterSend` вызывает `authStore.clear()`),
 * а редирект на /login асинхронный. Между этими двумя событиями прямой
 * `pb.authStore.model?.id` даёт `undefined`, и в базу уезжает отметка без
 * автора. Фолбэк на реестр last-known-user закрывает это окно.
 *
 * Событие чистки store воспроизводится честно: тест зовёт `pb.authStore.clear()`
 * на стабе, который зануляет модель ровно так же, как настоящий SDK.
 */

type Payload = Record<string, unknown>;

const h = vi.hoisted(() => ({
  auth: { model: null as { id: string; name: string; email: string } | null },
  rows: new Map<string, unknown>(),
  creates: new Map<string, Payload[]>(),
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
      return Promise.resolve({ id: `${name}_${log.length}`, ...body });
    },
    delete: () => Promise.resolve(true),
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
    },
  };
});

const LAST_KNOWN: IUser = {
  id: 'user-1',
  email: 'boss@example.com',
  login: 'boss',
  name: 'Пётр',
  avatar: '',
  verified: true,
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
};

function markFixture(overrides: Payload = {}): Payload {
  return {
    id: 'mark1',
    invoice_id: 'inv1',
    organization_id: 'org1',
    amount: 500,
    comment: 'оплатить до пятницы',
    status: 'proposed',
    created_by: 'user-0',
    created: '2026-10-01T09:00:00.000Z',
    ...overrides,
  };
}

/** Тело create() в указанную коллекцию; бросает, если записи туда не ушли. */
function createdIn(collection: string, index = 0): Payload {
  const body = h.creates.get(collection)?.[index];
  if (body === undefined) {
    throw new Error(`stub: не было create(${collection})[${index}]`);
  }
  return body;
}

beforeEach(() => {
  h.rows = new Map();
  h.creates = new Map();
});

/**
 * Реестр last-known-user — module-level состояние. Без сброса он утёк бы
 * в любой следующий тест этого же воркера, поэтому чистим и его, и store.
 */
afterEach(() => {
  pb.authStore.clear();
  setLastKnownUser(null);
});

describe('отметка к оплате — created_by при обнулённом authStore', () => {
  it('createPaymentMark берёт автора из реестра last-known-user', async () => {
    pb.authStore.clear();
    setLastKnownUser(LAST_KNOWN);

    await createPaymentMark({ invoice_id: 'inv1', organization_id: 'org1', amount: 500 });

    const createdBy = createdIn('payment_marks')['created_by'];
    expect(createdBy).toBe('user-1');
    expect(createdBy).not.toBeUndefined();
    expect(createdBy).not.toBe('');
  });

  it('approvePaymentMark берёт автора из реестра last-known-user', async () => {
    h.rows.set('payment_marks/mark1', markFixture());
    pb.authStore.clear();
    setLastKnownUser(LAST_KNOWN);

    await approvePaymentMark('mark1');

    const createdBy = createdIn('payment_marks')['created_by'];
    expect(createdBy).toBe('user-1');
    expect(createdBy).not.toBeUndefined();
    expect(createdBy).not.toBe('');
  });

  it('живая модель authStore побеждает реестр — fallback не подменяет сессию', async () => {
    h.auth.model = { id: 'user-live', name: 'Модератор', email: 'mod@example.com' };
    setLastKnownUser(LAST_KNOWN);

    await createPaymentMark({ invoice_id: 'inv1', organization_id: 'org1' });

    expect(createdIn('payment_marks')['created_by']).toBe('user-live');
  });

  it('автор записи истории тоже доезжает из реестра, а не становится unknown', async () => {
    pb.authStore.clear();
    setLastKnownUser(LAST_KNOWN);

    await createPaymentMark({ invoice_id: 'inv1', organization_id: 'org1' });

    expect(createdIn('invoice_history')['author']).toBe('Пётр');
  });

  it('без модели и без реестра автор пустой, а не выдуманный', async () => {
    pb.authStore.clear();
    setLastKnownUser(null);

    await createPaymentMark({ invoice_id: 'inv1', organization_id: 'org1' });

    expect(createdIn('payment_marks')['created_by']).toBe('');
  });
});
