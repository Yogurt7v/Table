import { pb } from './client';
import { getInvoiceFiles } from './collections';
import type {
  DocumentHistoryType,
  DocumentSourceInfo,
  IDocument,
  IDocumentComment,
  IDocumentFile,
  IDocumentHistory,
  IDeletedInvoice,
  IDeletedInvoiceFile,
  IInvoice,
  IInvoiceFile,
} from '@/shared/types';
import { foldSearchText } from '@/shared/utils/search-text';
import { normalizePbDate, normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { getLastKnownUser } from '@/shared/auth/last-known-user';

export const DOCUMENTS_COLLECTION = 'documents';
export const DOCUMENT_FILES_COLLECTION = 'document_files';
export const DOCUMENT_COMMENTS_COLLECTION = 'document_comments';
export const DOCUMENT_HISTORY_COLLECTION = 'document_history';

function qTag(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function currentActorId(): string {
  return pb.authStore.model?.id ?? getLastKnownUser()?.id ?? '';
}

function currentActorName(): string {
  const model = pb.authStore.model ?? getLastKnownUser();
  return model?.name || model?.email || '';
}

function normalizeDocument(record: IDocument): IDocument {
  return {
    ...record,
    organization_id: normalizeRelationId(record.organization_id),
    accounting_object_id: normalizeRelationId(record.accounting_object_id),
    responsible_id: normalizeRelationId(record.responsible_id),
    created_by: normalizeRelationId(record.created_by),
    payment_date: normalizePbDate(record.payment_date),
    deleted_at: record.deleted_at ? normalizePbDate(record.deleted_at) : undefined,
    seq: Number(record.seq) || 0,
    amount: Number(record.amount) || 0,
    sync_locked: Boolean(record.sync_locked),
    provided: Boolean(record.provided),
    confirmed: Boolean(record.confirmed),
    payment_cancelled: Boolean(record.payment_cancelled),
    is_deleted: Boolean(record.is_deleted),
    source_invoice_id: record.source_invoice_id || undefined,
    source_invoice_no: record.source_invoice_no || '',
    confirmed_file_id: record.confirmed_file_id || undefined,
    responsible_name: record.responsible_name || '',
    created_by_name: record.created_by_name || '',
    deleted_by_name: record.deleted_by_name || '',
    deletion_reason: record.deletion_reason || '',
  };
}

function normalizeDocumentFile(record: IDocumentFile): IDocumentFile {
  return {
    ...record,
    document_id: normalizeRelationId(record.document_id),
    organization_id: normalizeRelationId(record.organization_id),
    uploaded_by: record.uploaded_by ? normalizeRelationId(record.uploaded_by) : undefined,
    name: record.name || record.file,
  };
}

function normalizeDocumentComment(record: IDocumentComment): IDocumentComment {
  return {
    ...record,
    document_id: normalizeRelationId(record.document_id),
    organization_id: normalizeRelationId(record.organization_id),
    author: normalizeRelationId(record.author),
    author_name: record.author_name || '',
    text: record.text || '',
  };
}

function normalizeDocumentHistory(record: IDocumentHistory): IDocumentHistory {
  return {
    ...record,
    document_id: normalizeRelationId(record.document_id),
    organization_id: normalizeRelationId(record.organization_id),
    author: record.author ? normalizeRelationId(record.author) : undefined,
    author_name: record.author_name || '',
    changed_at: record.changed_at || record.created || '',
    previous_data: record.previous_data && typeof record.previous_data === 'object'
      ? record.previous_data
      : {},
  };
}

export async function listDocuments(params: {
  organizationId: string;
  role: 'admin' | 'moderator' | 'user' | 'guest' | 'boss';
  userId: string;
  includeDeleted?: boolean;
}): Promise<IDocument[]> {
  if (params.role === 'guest') return [];

  const clauses = [`organization_id = "${qTag(params.organizationId)}"`];
  if (!params.includeDeleted) clauses.push('is_deleted != true');
  if (params.role === 'user') clauses.push(`responsible_id = "${qTag(params.userId)}"`);

  const records = await pb.collection(DOCUMENTS_COLLECTION).getFullList<IDocument>({
    filter: clauses.join(' && '),
    sort: '-payment_date,-seq,-created',
  });
  return records.map(normalizeDocument);
}

export async function getArchivedDocuments(organizationId: string): Promise<IDocument[]> {
  const records = await pb.collection(DOCUMENTS_COLLECTION).getFullList<IDocument>({
    filter: `organization_id = "${qTag(organizationId)}" && is_deleted = true`,
    sort: '-deleted_at,-seq',
  });
  return records.map(normalizeDocument);
}

export async function getDocumentById(id: string): Promise<IDocument> {
  return normalizeDocument(await pb.collection(DOCUMENTS_COLLECTION).getOne<IDocument>(id));
}

export async function getDocumentFiles(documentId: string): Promise<IDocumentFile[]> {
  const records = await pb.collection(DOCUMENT_FILES_COLLECTION).getFullList<IDocumentFile>({
    filter: `document_id = "${qTag(documentId)}"`,
    sort: 'created',
  });
  return records.map(normalizeDocumentFile);
}

export async function getAllDocumentFiles(organizationId: string): Promise<IDocumentFile[]> {
  const records = await pb.collection(DOCUMENT_FILES_COLLECTION).getFullList<IDocumentFile>({
    filter: `organization_id = "${qTag(organizationId)}"`,
    sort: 'created',
  });
  return records.map(normalizeDocumentFile);
}

export async function getAllDocumentComments(
  organizationId: string,
): Promise<IDocumentComment[]> {
  const records = await pb.collection(DOCUMENT_COMMENTS_COLLECTION).getFullList<IDocumentComment>({
    filter: `organization_id = "${qTag(organizationId)}"`,
    sort: 'created',
  });
  return records.map(normalizeDocumentComment);
}

export async function getOrgInvoices(organizationId: string): Promise<IInvoice[]> {
  return pb.collection('invoices').getFullList<IInvoice>({
    filter: `organization_id = "${qTag(organizationId)}"`,
    sort: '-date,-seq',
  });
}

export async function getDocumentComments(documentId: string): Promise<IDocumentComment[]> {
  const records = await pb.collection(DOCUMENT_COMMENTS_COLLECTION).getFullList<IDocumentComment>({
    filter: `document_id = "${qTag(documentId)}"`,
    sort: 'created',
  });
  return records.map(normalizeDocumentComment);
}

export async function getDocumentHistory(documentId: string): Promise<IDocumentHistory[]> {
  const records = await pb.collection(DOCUMENT_HISTORY_COLLECTION).getFullList<IDocumentHistory>({
    filter: `document_id = "${qTag(documentId)}"`,
    sort: '-changed_at,-created',
  });
  return records.map(normalizeDocumentHistory);
}

export async function getNextDocumentSeq(
  organizationId: string,
  accountingObjectId: string,
): Promise<number> {
  const records = await pb.collection(DOCUMENTS_COLLECTION).getFullList<IDocument>({
    filter: `organization_id = "${qTag(organizationId)}" && accounting_object_id = "${qTag(accountingObjectId)}"`,
    fields: 'seq',
  });
  return records.reduce((max, record) => Math.max(max, Number(record.seq) || 0), 0) + 1;
}

export async function createDocumentHistory(
  documentId: string,
  organizationId: string,
  type: DocumentHistoryType,
  previousData: Record<string, unknown>,
): Promise<IDocumentHistory> {
  return normalizeDocumentHistory(
    await pb.collection(DOCUMENT_HISTORY_COLLECTION).create<IDocumentHistory>({
      document_id: documentId,
      organization_id: organizationId,
      author: currentActorId(),
      author_name: currentActorName(),
      changed_at: new Date().toISOString(),
      type,
      previous_data: previousData,
    }),
  );
}

export interface CreateDocumentInput {
  organizationId: string;
  accountingObjectId: string;
  paymentDate: string;
  counterparty: string;
  purpose?: string;
  contractNo?: string;
  invoiceNo?: string;
  amount?: number;
  responsibleId: string;
  responsibleName?: string;
  sourceInvoiceId?: string;
  sourceInvoiceNo?: string;
}

export async function createManualDocument(input: CreateDocumentInput): Promise<IDocument> {
  const seq = await getNextDocumentSeq(input.organizationId, input.accountingObjectId);
  const created = await pb.collection(DOCUMENTS_COLLECTION).create<IDocument>({
    organization_id: input.organizationId,
    accounting_object_id: input.accountingObjectId,
    seq,
    payment_date: input.paymentDate,
    counterparty: input.counterparty,
    purpose: input.purpose ?? '',
    contract_no: input.contractNo ?? '',
    invoice_no: input.invoiceNo ?? '',
    amount: input.amount ?? 0,
    responsible_id: input.responsibleId,
    responsible_name: input.responsibleName ?? '',
    created_by: currentActorId(),
    created_by_name: currentActorName(),
    source_invoice_id: input.sourceInvoiceId ?? '',
    source_invoice_no: input.sourceInvoiceNo ?? '',
    creation_mode: 'manual',
    sync_locked: true,
    provided: false,
    confirmed: false,
    payment_cancelled: false,
    is_deleted: false,
  });
  const normalized = normalizeDocument(created);
  await createDocumentHistory(normalized.id, normalized.organization_id, 'document_created', {
    creation_mode: 'manual',
    seq: normalized.seq,
    payment_date: normalized.payment_date,
    counterparty: normalized.counterparty,
    amount: normalized.amount,
    responsible_id: normalized.responsible_id,
  });
  return normalized;
}

const SYNCED_FIELDS = new Set<string>([
  'payment_date',
  'counterparty',
  'purpose',
  'contract_no',
  'invoice_no',
  'amount',
]);

export async function updateDocumentWithHistory(
  document: IDocument,
  data: Partial<IDocument>,
  type: DocumentHistoryType,
  previousData: Record<string, unknown>,
): Promise<IDocument> {
  const shouldLock = Object.keys(data).some((key) => SYNCED_FIELDS.has(key));
  const payload = shouldLock ? { ...data, sync_locked: true } : data;
  await createDocumentHistory(document.id, document.organization_id, type, previousData);
  const updated = await pb.collection(DOCUMENTS_COLLECTION).update<IDocument>(document.id, payload);
  return normalizeDocument(updated);
}

export async function updateDocumentStatus(
  document: IDocument,
  data: { provided?: boolean; confirmed?: boolean },
): Promise<IDocument> {
  const previous = {
    provided: document.provided,
    confirmed: document.confirmed,
    confirmed_file_id: document.confirmed_file_id ?? '',
  };
  const payload: Partial<IDocument> = { ...data };
  if (data.provided === false) {
    payload.confirmed = false;
    payload.confirmed_file_id = '';
  }
  if (data.confirmed === false) {
    payload.confirmed_file_id = '';
  }
  if (data.confirmed === true && !document.confirmed_file_id) {
    const files = await getDocumentFiles(document.id);
    payload.confirmed_file_id = files[0]?.id ?? '';
  }
  return updateDocumentWithHistory(document, payload, 'status_changed', previous);
}

export async function uploadDocumentFile(
  document: IDocument,
  file: File,
  displayName?: string,
): Promise<IDocumentFile> {
  const formData = new FormData();
  formData.append('document_id', document.id);
  formData.append('organization_id', document.organization_id);
  formData.append('file', file);
  formData.append('name', displayName?.trim() || file.name);
  const actorId = currentActorId();
  if (actorId) formData.append('uploaded_by', actorId);
  formData.append('uploaded_by_name', currentActorName());

  const created = normalizeDocumentFile(
    await pb.collection(DOCUMENT_FILES_COLLECTION).create<IDocumentFile>(formData),
  );

  const payload: Partial<IDocument> = {};
  if (!document.provided) payload.provided = true;
  if (Object.keys(payload).length > 0) {
    await updateDocumentWithHistory(document, payload, 'status_changed', {
      provided: document.provided,
      confirmed: document.confirmed,
    });
  }
  await createDocumentHistory(document.id, document.organization_id, 'file_added', {
    file_id: created.id,
    name: created.name,
  });
  return created;
}

export async function deleteDocumentFile(
  document: IDocument,
  file: IDocumentFile,
): Promise<IDocument> {
  await pb.collection(DOCUMENT_FILES_COLLECTION).delete(file.id);
  const remaining = await getDocumentFiles(document.id);
  const payload: Partial<IDocument> = {};

  if (document.confirmed_file_id === file.id) {
    payload.confirmed = false;
    payload.confirmed_file_id = '';
  }
  if (remaining.length === 0) {
    payload.provided = false;
    payload.confirmed = false;
    payload.confirmed_file_id = '';
  }

  const updated =
    Object.keys(payload).length > 0
      ? await updateDocumentWithHistory(document, payload, 'status_changed', {
          provided: document.provided,
          confirmed: document.confirmed,
          confirmed_file_id: document.confirmed_file_id ?? '',
        })
      : document;

  await createDocumentHistory(document.id, document.organization_id, 'file_removed', {
    file_id: file.id,
    name: file.name,
  });
  return updated;
}

export async function addDocumentComment(
  document: IDocument,
  text: string,
): Promise<IDocumentComment> {
  const comment = normalizeDocumentComment(
    await pb.collection(DOCUMENT_COMMENTS_COLLECTION).create<IDocumentComment>({
      document_id: document.id,
      organization_id: document.organization_id,
      author: currentActorId(),
      author_name: currentActorName(),
      text,
    }),
  );
  await createDocumentHistory(document.id, document.organization_id, 'comment_added', {
    comment_id: comment.id,
    text: comment.text,
  });
  return comment;
}

export async function deleteDocumentComment(
  document: IDocument,
  comment: IDocumentComment,
): Promise<void> {
  await pb.collection(DOCUMENT_COMMENTS_COLLECTION).delete(comment.id);
  await createDocumentHistory(document.id, document.organization_id, 'comment_deleted', {
    comment_id: comment.id,
    author: comment.author,
    author_name: comment.author_name,
    text: comment.text,
  });
}

export async function archiveDocument(document: IDocument, reason: string): Promise<IDocument> {
  const updated = await pb.collection(DOCUMENTS_COLLECTION).update<IDocument>(document.id, {
    is_deleted: true,
    deleted_by: currentActorId(),
    deleted_by_name: currentActorName(),
    deleted_at: new Date().toISOString(),
    deletion_reason: reason,
  });
  await createDocumentHistory(document.id, document.organization_id, 'document_archived', {
    reason,
    deleted_by_name: currentActorName(),
  });
  return normalizeDocument(updated);
}

export async function restoreDocument(document: IDocument): Promise<IDocument> {
  const seq = await getNextDocumentSeq(document.organization_id, document.accounting_object_id);
  const updated = await pb.collection(DOCUMENTS_COLLECTION).update<IDocument>(document.id, {
    is_deleted: false,
    deleted_by: '',
    deleted_by_name: '',
    deleted_at: '',
    deletion_reason: '',
    seq,
  });
  await createDocumentHistory(document.id, document.organization_id, 'document_restored', {
    previous_seq: document.seq,
    seq,
  });
  return normalizeDocument(updated);
}

export async function moveDocument(
  document: IDocument,
  accountingObjectId: string,
): Promise<IDocument> {
  if (document.accounting_object_id === accountingObjectId) return document;
  const seq = await getNextDocumentSeq(document.organization_id, accountingObjectId);
  const updated = await updateDocumentWithHistory(
    document,
    { accounting_object_id: accountingObjectId, seq },
    'object_changed',
    { accounting_object_id: document.accounting_object_id, seq: document.seq },
  );
  return updated;
}

export async function markPaymentCancelled(
  document: IDocument,
  cancelled: boolean,
): Promise<IDocument> {
  return updateDocumentWithHistory(
    document,
    {
      payment_cancelled: cancelled,
      ...(cancelled
        ? { provided: false, confirmed: false, confirmed_file_id: '' }
        : {}),
    },
    cancelled ? 'payment_cancelled' : 'payment_resumed',
    { payment_cancelled: document.payment_cancelled },
  );
}

export async function searchDocumentIdsByComment(
  organizationId: string,
  query: string,
): Promise<string[]> {
  const folded = foldSearchText(query);
  if (!folded) return [];
  const comments = await pb.collection(DOCUMENT_COMMENTS_COLLECTION).getFullList<IDocumentComment>({
    filter: `organization_id = "${qTag(organizationId)}"`,
    fields: 'document_id,text',
  });
  const ids = new Set<string>();
  for (const comment of comments) {
    if (foldSearchText(comment.text).includes(folded)) {
      ids.add(normalizeRelationId(comment.document_id));
    }
  }
  return [...ids];
}

export function getDocumentFileUrl(file: IDocumentFile): string {
  return pb.files.getURL(file, file.file);
}

export async function getSourceInvoiceInfo(
  document: IDocument,
): Promise<DocumentSourceInfo | null> {
  if (!document.source_invoice_id) return null;

  try {
    const invoice = await pb.collection('invoices').getOne<IInvoice>(document.source_invoice_id);
    const files = await getInvoiceFiles(invoice.id);
    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoice_no || '',
      counterparty: invoice.counterparty || '',
      amount: Number(invoice.amount) || 0,
      deleted: false,
      files: files.map((file: IInvoiceFile) => ({
        id: file.id,
        name: file.name || file.file,
        url: pb.files.getURL(file, file.file),
      })),
    };
  } catch {
    const deleted = await pb.collection('deleted_invoices').getFullList<IDeletedInvoice>({
      filter: `original_id = "${qTag(document.source_invoice_id)}"`,
      sort: '-deleted_at',
    });
    const archived = deleted[0];
    if (!archived) return null;
    const files = await pb.collection('deleted_invoice_files').getFullList<IDeletedInvoiceFile>({
      filter: `deleted_invoice_id = "${qTag(archived.id)}"`,
      sort: 'created',
    });
    return {
      invoiceId: archived.original_id,
      invoiceNo: archived.invoice_no || '',
      counterparty: archived.counterparty || '',
      amount: Number(archived.amount) || 0,
      deleted: true,
      files: files.map((file) => ({
        id: file.id,
        name: file.name || file.file,
        url: pb.files.getURL(file, file.file),
      })),
    };
  }
}
