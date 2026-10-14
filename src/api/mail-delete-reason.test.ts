import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deleteIncomingMail,
  deleteOutgoingMail,
  restoreDeletedIncomingMail,
  restoreDeletedOutgoingMail,
} from './mail';

/**
 * Причина удаления живёт в поле `comment` архивной записи — своего столбца у неё
 * нет. Тест проверяет ровно две вещи: строка причины ДОПИСЫВАЕТСЯ последней
 * строкой при удалении и СНИМАЕТСЯ при восстановлении.
 *
 * Префикс зашит литералом, а не константой `DELETION_REASON_PREFIX`: это формат,
 * который уже лежит в базе, и смена константы не должна молча её переписать.
 */

const PREFIX = 'причина удаления: ';

const { state } = vi.hoisted(() => ({
  state: {
    created: [] as Array<{ collection: string; payload: Record<string, unknown> }>,
    rows: new Map<string, Record<string, unknown>>(),
  },
}));

vi.mock('./client', () => ({
  pb: {
    authStore: { model: { id: 'user01hxyz', name: 'Иван', login: 'ivan' } },
    collection: (name: string) => ({
      getOne: async (id: string) => {
        const row = state.rows.get(id);
        if (!row) throw new Error(`Запись ${id} не найдена`);
        return row;
      },
      create: async (payload: Record<string, unknown>) => {
        state.created.push({ collection: name, payload });
        return { ...payload, id: `new-${state.created.length}` };
      },
      delete: async () => true,
      getFullList: async () => [],
    }),
  },
}));

function incomingMail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mail01hxyz',
    organization_id: 'org01hxyz',
    accounting_object_id: 'obj01hxyz',
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
    created_by: 'user01hxyz',
    created_by_name: 'Иван',
    updated_by: '',
    updated_by_name: '',
    ...overrides,
  };
}

function outgoingMail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mail02hxyz',
    organization_id: 'org01hxyz',
    accounting_object_id: '',
    seq: 4,
    outgoing_number: '7',
    date: '2024-03-02',
    counterparty_incoming_number: '99',
    subject: 'Исходящая тема',
    recipient: 'ООО Одуванчик',
    responsible: 'user01hxyz',
    responsible_name: 'Иван',
    delivery_method: 'post',
    comment: 'Комментарий исходящего',
    created_by: 'user01hxyz',
    created_by_name: 'Иван',
    updated_by: '',
    updated_by_name: '',
    ...overrides,
  };
}

function archivedIncoming(overrides: Record<string, unknown> = {}) {
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
    created_by: 'user01hxyz',
    created_by_name: 'Иван',
    deleted_by: 'user01hxyz',
    deleted_by_name: 'Иван',
    deleted_at: '2024-04-01T10:00:00.000Z',
    ...overrides,
  };
}

function archivedOutgoing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'del02hxyz',
    original_id: 'mail02hxyz',
    organization_id: 'org01hxyz',
    accounting_object_id: '',
    seq: 4,
    outgoing_number: '7',
    date: '2024-03-02',
    counterparty_incoming_number: '99',
    subject: 'Исходящая тема',
    recipient: 'ООО Одуванчик',
    responsible: 'user01hxyz',
    responsible_name: 'Иван',
    delivery_method: 'post',
    created_by: 'user01hxyz',
    created_by_name: 'Иван',
    deleted_by: 'user01hxyz',
    deleted_by_name: 'Иван',
    deleted_at: '2024-04-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Первая запись, ушедшая в указанную коллекцию, — архивная строка письма. */
function createdIn(collection: string): Record<string, unknown> {
  const entry = state.created.find((item) => item.collection === collection);
  if (!entry) throw new Error(`В коллекцию ${collection} ничего не записали`);
  return entry.payload;
}

beforeEach(() => {
  state.created = [];
  state.rows = new Map();
});

describe('deleteIncomingMail — причина удаления', () => {
  it('дописывает причину последней строкой, не трогая свой комментарий', async () => {
    state.rows.set('mail01hxyz', incomingMail());

    await deleteIncomingMail('mail01hxyz', 'отправили не тому');

    expect(createdIn('deleted_incoming_mails')['comment']).toBe(
      `Обычный комментарий\n${PREFIX}отправили не тому`,
    );
  });

  it('пустой комментарий письма даёт строку причины без ведущей пустой строки', async () => {
    state.rows.set('mail01hxyz', incomingMail({ comment: undefined }));

    await deleteIncomingMail('mail01hxyz', 'дубль');

    expect(createdIn('deleted_incoming_mails')['comment']).toBe(`${PREFIX}дубль`);
  });

  it('причина не попадает в previous_data записи истории архива', async () => {
    state.rows.set('mail01hxyz', incomingMail());

    await deleteIncomingMail('mail01hxyz', 'отправили не тому');

    const previousData = createdIn('deleted_mail_history')['previous_data'];
    expect(previousData).toEqual({
      deleted_by: 'user01hxyz',
      deleted_by_name: 'Иван',
      deleted_at: expect.any(String),
    });
  });
});

describe('deleteOutgoingMail — причина удаления', () => {
  it('дописывает причину последней строкой, не трогая свой комментарий', async () => {
    state.rows.set('mail02hxyz', outgoingMail());

    await deleteOutgoingMail('mail02hxyz', 'письмо не отправляли');

    expect(createdIn('deleted_outgoing_mails')['comment']).toBe(
      `Комментарий исходящего\n${PREFIX}письмо не отправляли`,
    );
  });

  it('пустой комментарий письма даёт строку причины без ведущей пустой строки', async () => {
    state.rows.set('mail02hxyz', outgoingMail({ comment: '' }));

    await deleteOutgoingMail('mail02hxyz', 'ошибочное');

    expect(createdIn('deleted_outgoing_mails')['comment']).toBe(`${PREFIX}ошибочное`);
  });
});

describe('restoreDeletedIncomingMail — маркер причины снимается', () => {
  it('возвращает в реестр комментарий без строки причины', async () => {
    state.rows.set(
      'del01hxyz',
      archivedIncoming({ comment: `Обычный комментарий\n${PREFIX}отправили не тому` }),
    );

    await restoreDeletedIncomingMail('del01hxyz');

    expect(createdIn('incoming_mails')['comment']).toBe('Обычный комментарий');
  });

  it('письмо без своего комментария возвращается с пустым, а не с пометкой', async () => {
    state.rows.set('del01hxyz', archivedIncoming({ comment: `${PREFIX}отправили не тому` }));

    await restoreDeletedIncomingMail('del01hxyz');

    expect(createdIn('incoming_mails')['comment']).toBe('');
  });

  it('причина из середины комментария остаётся на месте', async () => {
    state.rows.set(
      'del01hxyz',
      archivedIncoming({
        comment: `${PREFIX}написан пользователем\nвторая строка\n${PREFIX}отправили не тому`,
      }),
    );

    await restoreDeletedIncomingMail('del01hxyz');

    expect(createdIn('incoming_mails')['comment']).toBe(
      `${PREFIX}написан пользователем\nвторая строка`,
    );
  });
});

describe('restoreDeletedOutgoingMail — маркер причины снимается', () => {
  it('возвращает в реестр комментарий без строки причины', async () => {
    state.rows.set(
      'del02hxyz',
      archivedOutgoing({ comment: `Комментарий исходящего\n${PREFIX}письмо не отправляли` }),
    );

    await restoreDeletedOutgoingMail('del02hxyz');

    expect(createdIn('outgoing_mails')['comment']).toBe('Комментарий исходящего');
  });

  it('письмо без своего комментария возвращается с пустым, а не с пометкой', async () => {
    state.rows.set('del02hxyz', archivedOutgoing({ comment: `${PREFIX}письмо не отправляли` }));

    await restoreDeletedOutgoingMail('del02hxyz');

    expect(createdIn('outgoing_mails')['comment']).toBe('');
  });
});
