import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setLastKnownUser } from '@/shared/auth/last-known-user';
import { pb } from './client.ts';
import { restoreDeletedIncomingMail, restoreDeletedOutgoingMail } from './mail';

/**
 * Регрессия: клиент НЕ назначает автора восстанавливаемого письма — он шлёт
 * серверу ссылку на архивную запись, а автор резолвится на сервере.
 *
 * Раньше здесь стояло `created_by: deleted.created_by || currentActorId()`, и
 * тесты ниже подтверждали, что архивный автор доезжает до реестра. Тесты были
 * зелёными — и при этом НЕ описывали реальность: хук
 * `fillMailActorsOnCreateRequest` в `pb_hooks/mail-notify.pb.js` перезаписывал
 * `created_by` безусловно, поэтому письмо всё равно показывало восстановителя
 * автором, а весь клиентский фолбэк был мёртвым кодом. Проверено на живом
 * PocketBase: до правки хука `created_by` восстановленного письма равнялся id
 * восстановителя, несмотря на присланного клиентом архивного автора.
 *
 * Отсюда главное, что проверяют эти тесты: клиент не СУППУДАЕТ автора вовсе.
 * Присланное значение всё равно было бы затёрто сервером, а проверять его
 * тестом — значит проверять то, чего в проде не происходит.
 *
 * Миграция `1815000013_close_anonymous_create_hole` сделала `created_by`
 * обязательным в `incoming_mails`/`outgoing_mails`, но НЕ в архивных
 * коллекциях — архив остался нестрогим сознательно. У анонимно созданного
 * письма там лежит ПУСТАЯ СТРОКА, а не `null`. Фолбэк на восстановителя для
 * такого случая теперь живёт в хуке; клиент в нём не участвует.
 *
 * Мок — тот же, что в `mail-delete-reason.test.ts` (хук над `./client`,
 * `getOne`/`create`/`delete`/`getFullList`), плюс изменяемая модель authStore:
 * соседний `collections-payment-mark-actor.test.ts` проверяет ровно этот же
 * сценарий для `payment_marks`, и там чистить модель пришлось — отсюда
 * `clear()` в стабе и обязательный `afterEach`.
 */

type Payload = Record<string, unknown>;

const h = vi.hoisted(() => ({
  auth: { model: null as { id: string; name: string; login: string; email: string } | null },
  rows: new Map<string, unknown>(),
  creates: new Map<string, Payload[]>(),
}));

vi.mock('./client.ts', () => {
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

const ACTOR: { id: string; name: string; login: string; email: string } = {
  id: 'user01hxyz',
  name: 'Иван',
  login: 'ivan',
  email: 'ivan@example.com',
};

function archived(overrides: Payload = {}): Payload {
  return {
    id: 'del01hxyz',
    original_id: 'mail01hxyz',
    organization_id: 'org01hxyz',
    accounting_object_id: '',
    seq: 3,
    number: '12',
    date: '2024-03-01',
    sender_outgoing_number: '',
    subject: 'Тема письма',
    sender: 'ООО Ромашка',
    responsible: 'user01hxyz',
    responsible_name: 'Иван',
    delivery_method: 'email',
    comment: 'Обычный комментарий',
    // Анонимно созданное письмо: автор — пустая строка, а не null.
    created_by: '',
    created_by_name: '',
    deleted_by: 'user02hxyz',
    deleted_by_name: 'Пётр',
    deleted_at: '2024-04-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Тело create() в указанную коллекцию; бросает, если записи туда не ушли. */
function createdIn(collection: string): Payload {
  const body = h.creates.get(collection)?.[0];
  if (body === undefined) {
    throw new Error(`stub: не было create(${collection})`);
  }
  return body;
}

beforeEach(() => {
  h.rows = new Map();
  h.creates = new Map();
  h.auth.model = ACTOR;
});

/**
 * Реестр last-known-user — module-level состояние, общий для всего воркера.
 * Без сброса он утёк бы в соседние тестовые файлы, а модель стаба — тем более.
 */
afterEach(() => {
  pb.authStore.clear();
  setLastKnownUser(null);
});

describe('restoreDeletedIncomingMail — автор восстановления решает сервер', () => {
  it('в create уходит ссылка на архив, а не сам автор', async () => {
    h.rows.set(
      'deleted_incoming_mails/del01hxyz',
      archived({ created_by: 'user09legacy', created_by_name: 'Автор' }),
    );

    await restoreDeletedIncomingMail('del01hxyz');

    const body = createdIn('incoming_mails');
    expect(body['restored_from_inmail_id']).toBe('del01hxyz');
  });

  it('архивный автор НЕ отправляется: хук всё равно его бы затёр', async () => {
    h.rows.set(
      'deleted_incoming_mails/del01hxyz',
      archived({ created_by: 'user09legacy', created_by_name: 'Автор' }),
    );

    await restoreDeletedIncomingMail('del01hxyz');

    const body = createdIn('incoming_mails');
    expect(body['created_by']).toBeUndefined();
    expect(body['created_by_name']).toBeUndefined();
  });

  it('пустой архивный автор тоже не отправляется — фолбэк живёт в хуке', async () => {
    h.rows.set('deleted_incoming_mails/del01hxyz', archived());

    await restoreDeletedIncomingMail('del01hxyz');

    const body = createdIn('incoming_mails');
    expect(body['created_by']).toBeUndefined();
    expect(body['restored_from_inmail_id']).toBe('del01hxyz');
  });

  it('updated_by остаётся за восстановителем — он правда им редактировал', async () => {
    h.rows.set('deleted_incoming_mails/del01hxyz', archived());

    await restoreDeletedIncomingMail('del01hxyz');

    expect(createdIn('incoming_mails')['updated_by']).toBe(ACTOR.id);
  });
});

describe('restoreDeletedOutgoingMail — автор восстановления решает сервер', () => {
  const outgoingArchive = (overrides: Payload = {}): Payload =>
    archived({
      id: 'del02hxyz',
      original_id: 'mail02hxyz',
      accounting_object_id: '',
      outgoing_number: '7',
      counterparty_incoming_number: '99',
      recipient: 'ООО Одуванчик',
      delivery_method: 'post',
      ...overrides,
    });

  it('в create уходит ссылка на архив, а не сам автор', async () => {
    h.rows.set('deleted_outgoing_mails/del02hxyz', outgoingArchive());

    await restoreDeletedOutgoingMail('del02hxyz');

    expect(createdIn('outgoing_mails')['restored_from_outmail_id']).toBe('del02hxyz');
  });

  it('архивный автор НЕ отправляется: хук всё равно его бы затёр', async () => {
    h.rows.set(
      'deleted_outgoing_mails/del02hxyz',
      outgoingArchive({ created_by: 'user09legacy', created_by_name: 'Автор' }),
    );

    await restoreDeletedOutgoingMail('del02hxyz');

    const body = createdIn('outgoing_mails');
    expect(body['created_by']).toBeUndefined();
    expect(body['created_by_name']).toBeUndefined();
  });

  it('updated_by остаётся за восстановителем', async () => {
    h.rows.set('deleted_outgoing_mails/del02hxyz', outgoingArchive());

    await restoreDeletedOutgoingMail('del02hxyz');

    expect(createdIn('outgoing_mails')['updated_by']).toBe(ACTOR.id);
  });
});
