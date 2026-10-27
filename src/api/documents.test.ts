import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDocument, IDocumentFile } from '@/shared/types';
import {
  addDocumentComment,
  archiveDocument,
  createManualDocument,
  deleteDocumentComment,
  deleteDocumentFile,
  getNextDocumentSeq,
  listDocuments,
  markPaymentCancelled,
  moveDocument,
  restoreDocument,
  searchDocumentIdsByComment,
  updateDocumentStatus,
  updateDocumentWithHistory,
  uploadDocumentFile,
} from './documents';

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
    seq: 3,
    payment_date: '2026-10-14',
    counterparty: 'ООО Ромашка',
    purpose: 'Назначение',
    contract_no: 'Д-1',
    invoice_no: 'СЧ-7',
    amount: 1200,
    responsible_id: 'u1',
    responsible_name: 'Модератор',
    created_by: 'u2',
    created_by_name: 'Автор',
    creation_mode: 'auto',
    sync_locked: false,
    provided: false,
    confirmed: false,
    payment_cancelled: false,
    is_deleted: false,
    ...overrides,
  };
}

function fileFixture(overrides: Partial<IDocumentFile> = {}): IDocumentFile {
  return {
    id: 'file1',
    document_id: 'doc1',
    organization_id: 'org1',
    file: 'scan.pdf',
    name: 'scan.pdf',
    uploaded_by: 'u1',
    uploaded_by_name: 'Модератор',
    created: '2026-10-14T10:00:00.000Z',
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

describe('listDocuments', () => {
  it('filters non-deleted documents for admin without responsible restriction', async () => {
    putList('documents', [documentFixture({ id: 'doc1' }), documentFixture({ id: 'doc2', is_deleted: true })]);

    const result = await listDocuments({ organizationId: 'org1', role: 'admin', userId: 'u9' });

    expect(result.map((doc) => doc.id)).toEqual(['doc1', 'doc2']);
    const params = h.stub.calls.get('documents.getFullList')?.[0] as { filter?: string };
    expect(params.filter).toContain('organization_id = "org1"');
    expect(params.filter).toContain('is_deleted != true');
    expect(params.filter).not.toContain('responsible_id');
  });

  it('restricts live documents to the responsible user', async () => {
    putList('documents', [
      documentFixture({ id: 'mine', responsible_id: 'u1' }),
      documentFixture({ id: 'foreign', responsible_id: 'u2' }),
    ]);

    const result = await listDocuments({ organizationId: 'org1', role: 'user', userId: 'u1' });

    expect(result.map((doc) => doc.id)).toEqual(['mine', 'foreign']);
    const params = h.stub.calls.get('documents.getFullList')?.[0] as { filter?: string };
    expect(params.filter).toContain('responsible_id = "u1"');
  });

  it('includes deleted documents when requested', async () => {
    putList('documents', [documentFixture({ id: 'deleted', is_deleted: true })]);

    const result = await listDocuments({ organizationId: 'org1', role: 'admin', userId: 'u1', includeDeleted: true });

    expect(result.map((doc) => doc.id)).toEqual(['deleted']);
    const params = h.stub.calls.get('documents.getFullList')?.[0] as { filter?: string };
    expect(params.filter).not.toContain('is_deleted != true');
  });
});

describe('getNextDocumentSeq', () => {
  it('returns one for an empty object', async () => {
    putList('documents', []);
    await expect(getNextDocumentSeq('org1', 'obj1')).resolves.toBe(1);
  });

  it('returns max seq plus one', async () => {
    putList('documents', [documentFixture({ seq: 2 }), documentFixture({ id: 'doc2', seq: 7 })]);
    await expect(getNextDocumentSeq('org1', 'obj1')).resolves.toBe(8);
  });
});

describe('createManualDocument', () => {
  it('creates a frozen manual document and writes creation history', async () => {
    putList('documents', []);

    const result = await createManualDocument({
      organizationId: 'org1',
      accountingObjectId: 'obj1',
      paymentDate: '2026-10-14',
      counterparty: 'ООО Ромашка',
      purpose: 'Назначение',
      contractNo: 'Д-1',
      invoiceNo: 'СЧ-7',
      amount: 1200,
      responsibleId: 'u3',
      responsibleName: 'Ответственный',
      sourceInvoiceId: 'inv1',
      sourceInvoiceNo: 'СЧ-7',
    });

    expect(result.id).toBe('documents_new');
    const body = created('documents')!;
    expect(body).toMatchObject({
      organization_id: 'org1',
      accounting_object_id: 'obj1',
      seq: 1,
      payment_date: '2026-10-14',
      counterparty: 'ООО Ромашка',
      creation_mode: 'manual',
      sync_locked: true,
      provided: false,
      confirmed: false,
      responsible_id: 'u3',
      source_invoice_id: 'inv1',
    });
    const history = created('document_history')!;
    expect(history).toMatchObject({
      document_id: 'documents_new',
      type: 'document_created',
    });
  });
});

describe('updateDocumentWithHistory', () => {
  it('locks sync when a synced field changes', async () => {
    const document = documentFixture({ sync_locked: false });

    await updateDocumentWithHistory(document, { counterparty: 'Новый контрагент' }, 'document_updated', {
      counterparty: document.counterparty,
    });

    const body = updated('documents');
    expect(body).toMatchObject({ counterparty: 'Новый контрагент', sync_locked: true });
    expect(created('document_history')).toMatchObject({ type: 'document_updated' });
  });

  it('does not lock sync for status-only changes', async () => {
    const document = documentFixture({ sync_locked: false });

    await updateDocumentWithHistory(document, { provided: true }, 'status_changed', {
      provided: false,
    });

    const body = updated('documents');
    expect(body).toMatchObject({ provided: true });
    expect(body).not.toHaveProperty('sync_locked');
  });
});

describe('updateDocumentStatus', () => {
  it('resets confirmation when provided becomes false', async () => {
    const document = documentFixture({ provided: true, confirmed: true, confirmed_file_id: 'file1' });
    putList('document_files', [fileFixture()]);

    await updateDocumentStatus(document, { provided: false });

    const body = updated('documents');
    expect(body).toMatchObject({ provided: false, confirmed: false, confirmed_file_id: '' });
  });

  it('selects the first file when confirming without a confirmed file', async () => {
    const document = documentFixture({ provided: true, confirmed: false });
    putList('document_files', [fileFixture({ id: 'file9' }), fileFixture({ id: 'file10' })]);

    await updateDocumentStatus(document, { confirmed: true });

    const body = updated('documents');
    expect(body).toMatchObject({ confirmed: true, confirmed_file_id: 'file9' });
  });
});

describe('uploadDocumentFile', () => {
  it('creates a file, sets provided automatically and writes file history', async () => {
    const document = documentFixture({ provided: false });
    const file = new File(['content'], 'scan.pdf', { type: 'application/pdf' });

    await uploadDocumentFile(document, file, 'Скан');

    const uploaded = await uploadDocumentFile(document, file, 'Скан');
    expect(uploaded).toMatchObject({ id: 'document_files_new', document_id: 'doc1', name: 'Скан', uploaded_by: 'u1' });
    const statusBody = updated('documents');
    expect(statusBody).toMatchObject({ provided: true });
    const histories = h.stub.creates.get('document_history')!;
    const history = histories[histories.length - 1]!;
    expect(history).toMatchObject({ type: 'file_added' });
    expect(history.previous_data).toMatchObject({ name: 'Скан' });
  });
});

describe('deleteDocumentFile', () => {
  it('resets both statuses when the last file is removed', async () => {
    const document = documentFixture({ provided: true, confirmed: true, confirmed_file_id: 'file1' });
    putList('document_files', []);

    const result = await deleteDocumentFile(document, fileFixture({ id: 'file1' }));

    expect(result.id).toBe('doc1');
    const body = updated('documents');
    expect(body).toMatchObject({ provided: false, confirmed: false, confirmed_file_id: '' });
    expect(h.stub.deletes).toContain('document_files/file1');
    const deleteHistories = h.stub.creates.get('document_history')!;
    expect(deleteHistories[deleteHistories.length - 1]).toMatchObject({ type: 'file_removed' });
  });

  it('removes confirmation only for the deleted confirmed file', async () => {
    const document = documentFixture({ provided: true, confirmed: true, confirmed_file_id: 'file1' });
    putList('document_files', [fileFixture({ id: 'file2' })]);

    await deleteDocumentFile(document, fileFixture({ id: 'file1' }));

    const body = updated('documents');
    expect(body).toMatchObject({ confirmed: false, confirmed_file_id: '' });
    expect(body).not.toHaveProperty('provided');
  });
});

describe('comments', () => {
  it('adds a comment and writes history', async () => {
    const document = documentFixture();

    await addDocumentComment(document, '  Текст комментария  ');

    const body = created('document_comments');
    expect(body).toMatchObject({
      document_id: 'doc1',
      organization_id: 'org1',
      author: 'u1',
      text: '  Текст комментария  ',
    });
    expect(created('document_history')).toMatchObject({ type: 'comment_added' });
  });

  it('deletes a comment and records its text in history', async () => {
    const document = documentFixture();
    const comment = { id: 'comment1', document_id: 'doc1', organization_id: 'org1', author: 'u2', author_name: 'Автор', text: 'Удалить', created: '2026-10-14T10:00:00.000Z' };

    await deleteDocumentComment(document, comment);

    expect(h.stub.deletes).toContain('document_comments/comment1');
    expect(created('document_history')).toMatchObject({
      type: 'comment_deleted',
      previous_data: expect.objectContaining({ text: 'Удалить' }),
    });
  });
});

describe('archive and restore', () => {
  it('archives a document with reason and history', async () => {
    const document = documentFixture();

    await archiveDocument(document, '  причина  ');

    const body = updated('documents');
    expect(body).toMatchObject({
      is_deleted: true,
      deleted_by: 'u1',
      deleted_by_name: 'Модератор',
      deletion_reason: '  причина  ',
    });
    expect(created('document_history')).toMatchObject({ type: 'document_archived' });
  });

  it('restores with a new seq and writes history', async () => {
    const document = documentFixture({ seq: 3 });
    putList('documents', [documentFixture({ id: 'other', seq: 9 })]);

    await restoreDocument(document);

    const body = updated('documents');
    expect(body).toMatchObject({ is_deleted: false, seq: 10, deletion_reason: '' });
    expect(created('document_history')).toMatchObject({ type: 'document_restored' });
  });
});

describe('moveDocument and markPaymentCancelled', () => {
  it('moves document to another object with a new seq', async () => {
    const document = documentFixture({ accounting_object_id: 'obj1', seq: 3 });
    putList('documents', []);

    await moveDocument(document, 'obj2');

    const body = updated('documents');
    expect(body).toMatchObject({ accounting_object_id: 'obj2', seq: 1 });
    expect(created('document_history')).toMatchObject({ type: 'object_changed' });
  });

  it('marks payment cancelled and resets statuses', async () => {
    const document = documentFixture({ provided: true, confirmed: true, confirmed_file_id: 'file1' });

    await markPaymentCancelled(document, true);

    const body = updated('documents');
    expect(body).toMatchObject({ payment_cancelled: true, provided: false, confirmed: false, confirmed_file_id: '' });
    expect(created('document_history')).toMatchObject({ type: 'payment_cancelled' });
  });

  it('resumes payment without resetting statuses', async () => {
    const document = documentFixture({ payment_cancelled: true });

    await markPaymentCancelled(document, false);

    const body = updated('documents');
    expect(body).toMatchObject({ payment_cancelled: false });
    expect(body).not.toHaveProperty('provided');
    expect(created('document_history')).toMatchObject({ type: 'payment_resumed' });
  });
});

describe('searchDocumentIdsByComment', () => {
  it('returns document ids whose comments match case-insensitively', async () => {
    putList('document_comments', [
      { id: 'c1', document_id: 'doc1', organization_id: 'org1', author: 'u1', author_name: 'A', text: 'Нужен СЧЁТ', created: '' },
      { id: 'c2', document_id: 'doc2', organization_id: 'org1', author: 'u1', author_name: 'A', text: 'другой текст', created: '' },
    ]);

    await expect(searchDocumentIdsByComment('org1', 'счёт')).resolves.toEqual(['doc1']);
  });

  it('returns an empty list for an empty query', async () => {
    putList('document_comments', []);
    await expect(searchDocumentIdsByComment('org1', '   ')).resolves.toEqual([]);
  });
});
