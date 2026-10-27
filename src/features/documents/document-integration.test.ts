import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDocument } from '@/shared/types';

type Payload = Record<string, unknown>;

interface Stub {
  one: Map<string, unknown>;
  list: Map<string, unknown[]>;
  creates: Map<string, Payload[]>;
  updates: Map<string, Payload[]>;
  deletes: string[];
  calls: Map<string, unknown[]>;
}

const h = vi.hoisted(() => ({
  stub: {
    one: new Map(),
    list: new Map(),
    creates: new Map(),
    updates: new Map(),
    deletes: [],
    calls: new Map(),
  } as Stub,
}));

vi.mock('@/api/client', () => {
  const record = (name: string) => ({
    getOne: (id: string) => {
      const found = h.stub.one.get(`${name}/${id}`);
      if (found === undefined) throw new Error(`stub: нет записи ${name}/${id}`);
      h.stub.calls.set(`${name}.getOne`, [...(h.stub.calls.get(`${name}.getOne`) ?? []), id]);
      return Promise.resolve(found);
    },
    getFullList: (params?: unknown) => {
      h.stub.calls.set(`${name}.getFullList`, [...(h.stub.calls.get(`${name}.getFullList`) ?? []), params]);
      return Promise.resolve(h.stub.list.get(name) ?? []);
    },
    create: (body: Payload) => {
      const log = h.stub.creates.get(name) ?? [];
      log.push(body);
      h.stub.creates.set(name, log);
      if (body instanceof FormData) {
        const record: Payload = { id: `${name}_new` };
        for (const [key, value] of body.entries()) record[key] = value;
        return Promise.resolve(record);
      }
      return Promise.resolve({ id: `${name}_new`, ...body });
    },
    update: (id: string, body: Payload) => {
      const log = h.stub.updates.get(name) ?? [];
      log.push({ id, ...body });
      h.stub.updates.set(name, log);
      return Promise.resolve({ id, ...body });
    },
    delete: (id: string) => {
      h.stub.deletes.push(`${name}/${id}`);
      return Promise.resolve(true);
    },
    unsubscribe: () => Promise.resolve(),
  });

  return {
    pb: {
      authStore: { model: { id: 'u1', name: 'Модератор', email: 'mod@example.com' } },
      collection: record,
    },
  };
});

function putList(collection: string, value: unknown[]) {
  h.stub.list.set(collection, value);
}

function created(collection: string, index = 0): Payload | undefined {
  return h.stub.creates.get(collection)?.[index];
}

function updated(collection: string, index = 0): Payload | undefined {
  return h.stub.updates.get(collection)?.[index];
}

function documentFixture(overrides: Partial<IDocument> = {}): IDocument {
  return {
    id: 'doc1',
    organization_id: 'org1',
    accounting_object_id: 'obj1',
    seq: 1,
    payment_date: '2026-10-14',
    counterparty: 'ООО Тест',
    purpose: 'Назначение',
    contract_no: 'Д-1',
    invoice_no: 'СЧ-1',
    amount: 1000,
    responsible_id: 'u1',
    responsible_name: 'Ответственный',
    created_by: 'u2',
    created_by_name: 'Автор',
    source_invoice_id: 'inv1',
    source_invoice_no: 'СЧ-1',
    creation_mode: 'auto',
    sync_locked: false,
    provided: false,
    confirmed: false,
    confirmed_file_id: '',
    payment_cancelled: false,
    is_deleted: false,
    ...overrides,
  };
}

beforeEach(() => {
  h.stub.one = new Map();
  h.stub.list = new Map();
  h.stub.creates = new Map();
  h.stub.updates = new Map();
  h.stub.deletes = [];
  h.stub.calls = new Map();
  putList('document_history', []);
  putList('document_files', []);
  putList('document_comments', []);
});

describe('document integration: auto-creation and deduplication', () => {
  it('creates exactly one auto document per invoice chain', async () => {
    putList('documents', []);
    const { createManualDocument } = await import('@/api/documents');
    const doc = await createManualDocument({
      organizationId: 'org1',
      accountingObjectId: 'obj1',
      paymentDate: '2026-10-14',
      counterparty: 'ООО Тест',
      responsibleId: 'u1',
    });
    expect(doc.id).toBe('documents_new');
    const body = created('documents')!;
    expect(body.creation_mode).toBe('manual');
    expect(body.sync_locked).toBe(true);
  });

  it('does not create duplicate when documents list already has entries', async () => {
    putList('documents', [documentFixture({ id: 'existing' })]);
    const { getNextDocumentSeq } = await import('@/api/documents');
    const seq = await getNextDocumentSeq('org1', 'obj1');
    expect(seq).toBe(2);
  });
});

describe('document integration: seq uniqueness per object', () => {
  it('returns max seq + 1 for an object', async () => {
    putList('documents', [
      documentFixture({ id: 'd1', seq: 3 }),
      documentFixture({ id: 'd2', seq: 7 }),
    ]);
    const { getNextDocumentSeq } = await import('@/api/documents');
    const seq = await getNextDocumentSeq('org1', 'obj1');
    expect(seq).toBe(8);
  });

  it('returns 1 for empty object', async () => {
    putList('documents', []);
    const { getNextDocumentSeq } = await import('@/api/documents');
    const seq = await getNextDocumentSeq('org1', 'obj1');
    expect(seq).toBe(1);
  });
});

describe('document integration: archive and restore', () => {
  it('archives a document with reason', async () => {
    const document = documentFixture();
    const { archiveDocument } = await import('@/api/documents');
    await archiveDocument(document, 'тестовая причина');
    const body = updated('documents')!;
    expect(body.is_deleted).toBe(true);
    expect(body.deletion_reason).toBe('тестовая причина');
    expect(body.deleted_by).toBe('u1');
  });

  it('restores a document with new seq', async () => {
    const document = documentFixture({ seq: 3 });
    putList('documents', [documentFixture({ id: 'other', seq: 9 })]);
    const { restoreDocument } = await import('@/api/documents');
    await restoreDocument(document);
    const body = updated('documents')!;
    expect(body.is_deleted).toBe(false);
    expect(body.seq).toBe(10);
    expect(body.deletion_reason).toBe('');
  });
});

describe('document integration: payment cancel and resume', () => {
  it('marks payment cancelled and resets statuses', async () => {
    const document = documentFixture({ provided: true, confirmed: true, confirmed_file_id: 'file1' });
    const { markPaymentCancelled } = await import('@/api/documents');
    await markPaymentCancelled(document, true);
    const body = updated('documents')!;
    expect(body.payment_cancelled).toBe(true);
    expect(body.provided).toBe(false);
    expect(body.confirmed).toBe(false);
    expect(body.confirmed_file_id).toBe('');
  });

  it('resumes payment without resetting statuses', async () => {
    const document = documentFixture({ payment_cancelled: true, provided: false, confirmed: false });
    const { markPaymentCancelled } = await import('@/api/documents');
    await markPaymentCancelled(document, false);
    const body = updated('documents')!;
    expect(body.payment_cancelled).toBe(false);
    // provided/confirmed are not in the update payload on resume
    expect(body.provided).toBeUndefined();
  });
});
