/** Создание, обновление, статусы, файлы, комментарии и архивирование документов. */

import { pb } from '@/api/client';
import type {
  DocumentHistoryChange,
  DocumentHistoryPayloadV2,
  DocumentHistorySource,
  DocumentHistoryType,
  IDocument,
  IDocumentComment,
  IDocumentFile,
} from '@/shared/types';
import {
  DOCUMENT_COMMENTS_COLLECTION,
  DOCUMENT_FILES_COLLECTION,
  DOCUMENTS_COLLECTION,
} from './constants.ts';
import { createDocumentHistory } from './history.ts';
import { normalizeDocument, normalizeDocumentComment, normalizeDocumentFile } from './normalize.ts';
import { getDocumentFiles, getNextDocumentSeq } from './reads.ts';
import { currentActorId, currentActorName } from './shared.ts';

interface HistoryWriteOptions {
  source?: DocumentHistorySource;
  changes?: DocumentHistoryChange[];
  meta?: Record<string, unknown>;
}

function historyPayload(options: HistoryWriteOptions): DocumentHistoryPayloadV2 {
  return {
    v: 2,
    source: options.source ?? 'ui',
    changes: options.changes ?? [],
    meta: options.meta ?? {},
  };
}

function changedValue(before: unknown, after: unknown): boolean {
  if (before === after) return false;
  return String(before ?? '') !== String(after ?? '') || Number.isNaN(before as number);
}

function pushChange(
  changes: DocumentHistoryChange[],
  field: string,
  from: unknown,
  to: unknown,
  labels?: { from_label?: string; to_label?: string },
): void {
  if (!changedValue(from, to)) return;
  const change: DocumentHistoryChange = { field, from, to };
  if (labels?.from_label !== undefined) change.from_label = labels.from_label;
  if (labels?.to_label !== undefined) change.to_label = labels.to_label;
  changes.push(change);
}

/** Входные данные для создания документа вручную. */
export interface CreateDocumentInput {
  organizationId: string;
  accountingObjectId: string;
  paymentDate?: string;
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

/** Создаёт документ вручную, фиксирует seq и записывает историю создания. */
export async function createManualDocument(input: CreateDocumentInput): Promise<IDocument> {
  const seq = await getNextDocumentSeq(input.organizationId, input.accountingObjectId);
  const created = await pb.collection(DOCUMENTS_COLLECTION).create<IDocument>({
    organization_id: input.organizationId,
    accounting_object_id: input.accountingObjectId,
    seq,
    payment_date: input.paymentDate ?? '',
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
  await createDocumentHistory(
    normalized.id,
    normalized.organization_id,
    'document_created',
    historyPayload({
      source: 'ui',
      changes: [
        { field: 'accounting_object_id', to: normalized.accounting_object_id },
        { field: 'seq', to: normalized.seq },
        { field: 'payment_date', to: normalized.payment_date },
        { field: 'counterparty', to: normalized.counterparty },
        { field: 'amount', to: normalized.amount },
        {
          field: 'responsible_id',
          to: normalized.responsible_id,
          to_label: normalized.responsible_name || '',
        },
      ],
      meta: { creation_mode: 'manual' },
    }),
  );
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

/** Обновляет документ с записью истории; правка синхронизируемых полей ставит sync_locked. */
export async function updateDocumentWithHistory(
  document: IDocument,
  data: Partial<IDocument>,
  type: DocumentHistoryType,
  previousData: Record<string, unknown> | DocumentHistoryPayloadV2,
  options: HistoryWriteOptions = {},
): Promise<IDocument> {
  const shouldLock = Object.keys(data).some((key) => SYNCED_FIELDS.has(key));
  const payload = shouldLock ? { ...data, sync_locked: true } : data;
  await createDocumentHistory(document.id, document.organization_id, type, previousData, options);
  const updated = await pb.collection(DOCUMENTS_COLLECTION).update<IDocument>(document.id, payload);
  return normalizeDocument(updated);
}

/** Обновляет статусы предоставления/подтверждения документа с согласованием полей. */
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
  let confirmedFileLabel = '';
  if (data.confirmed === true && !document.confirmed_file_id) {
    const files = await getDocumentFiles(document.id);
    payload.confirmed_file_id = files[0]?.id ?? '';
    confirmedFileLabel = files[0]?.name ?? '';
  }

  const changes: DocumentHistoryChange[] = [];
  pushChange(changes, 'provided', previous.provided, payload.provided ?? previous.provided);
  pushChange(changes, 'confirmed', previous.confirmed, payload.confirmed ?? previous.confirmed);
  pushChange(
    changes,
    'confirmed_file_id',
    previous.confirmed_file_id,
    payload.confirmed_file_id ?? previous.confirmed_file_id,
    {
      from_label: previous.confirmed_file_id ? previous.confirmed_file_id : '',
      to_label: confirmedFileLabel || (payload.confirmed_file_id ?? previous.confirmed_file_id),
    },
  );

  return updateDocumentWithHistory(document, payload, 'status_changed', historyPayload({ source: 'ui', changes }));
}

/** Загружает файл документа, при необходимости отмечает документ предоставленным. */
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
    await pb.collection(DOCUMENTS_COLLECTION).update<IDocument>(document.id, payload);
  }

  const changes: DocumentHistoryChange[] = [];
  pushChange(changes, 'provided', document.provided, payload.provided ?? document.provided);
  await createDocumentHistory(
    document.id,
    document.organization_id,
    'file_added',
    historyPayload({
      source: 'ui',
      changes,
      meta: { file: { id: created.id, name: created.name } },
    }),
  );
  return created;
}

/** Удаляет файл документа и корректирует статусы/подтверждающий файл при необходимости. */
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

  const changes: DocumentHistoryChange[] = [];
  pushChange(changes, 'provided', document.provided, payload.provided ?? document.provided);
  pushChange(changes, 'confirmed', document.confirmed, payload.confirmed ?? document.confirmed);
  pushChange(
    changes,
    'confirmed_file_id',
    document.confirmed_file_id ?? '',
    payload.confirmed_file_id ?? document.confirmed_file_id ?? '',
    {
      from_label: document.confirmed_file_id === file.id ? file.name : document.confirmed_file_id ?? '',
      to_label: payload.confirmed_file_id ?? '',
    },
  );

  let updated = document;
  if (Object.keys(payload).length > 0) {
    updated = normalizeDocument(
      await pb.collection(DOCUMENTS_COLLECTION).update<IDocument>(document.id, payload),
    );
  }

  await createDocumentHistory(
    document.id,
    document.organization_id,
    'file_removed',
    historyPayload({
      source: 'ui',
      changes,
      meta: {
        file: { id: file.id, name: file.name },
        was_confirmed_file: document.confirmed_file_id === file.id,
        was_last_file: remaining.length === 0,
      },
    }),
  );
  return updated;
}

/** Добавляет комментарий к документу и записывает событие в историю. */
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
  await createDocumentHistory(
    document.id,
    document.organization_id,
    'comment_added',
    historyPayload({
      source: 'ui',
      meta: { comment: { id: comment.id, text: comment.text } },
    }),
  );
  return comment;
}

/** Удаляет комментарий документа и записывает событие в историю. */
export async function deleteDocumentComment(
  document: IDocument,
  comment: IDocumentComment,
): Promise<void> {
  await pb.collection(DOCUMENT_COMMENTS_COLLECTION).delete(comment.id);
  await createDocumentHistory(
    document.id,
    document.organization_id,
    'comment_deleted',
    historyPayload({
      source: 'ui',
      meta: {
        comment: {
          id: comment.id,
          text: comment.text,
          author_name: comment.author_name,
        },
      },
    }),
  );
}

/** Архивирует (помечает удалённым) документ с указанием причины. */
export async function archiveDocument(document: IDocument, reason: string): Promise<IDocument> {
  const updated = await pb.collection(DOCUMENTS_COLLECTION).update<IDocument>(document.id, {
    is_deleted: true,
    deleted_by: currentActorId(),
    deleted_by_name: currentActorName(),
    deleted_at: new Date().toISOString(),
    deletion_reason: reason,
  });
  // Историю archive/restore пишет PB hook document-archive.pb.js, чтобы не было дублей.
  return normalizeDocument(updated);
}

/** Восстанавливает документ из архива и назначает новый seq в объекте учёта. */
export async function restoreDocument(document: IDocument): Promise<IDocument> {
  const updated = await pb.collection(DOCUMENTS_COLLECTION).update<IDocument>(document.id, {
    is_deleted: false,
  });
  // Историю archive/restore пишет PB hook document-archive.pb.js, чтобы не было дублей.
  return normalizeDocument(updated);
}

/** Переносит документ в другой объект учёта с назначением нового seq. */
export async function moveDocument(
  document: IDocument,
  accountingObjectId: string,
  labels?: { fromObjectName?: string; toObjectName?: string },
): Promise<IDocument> {
  if (document.accounting_object_id === accountingObjectId) return document;
  const seq = await getNextDocumentSeq(document.organization_id, accountingObjectId);
  const updated = await updateDocumentWithHistory(
    document,
    { accounting_object_id: accountingObjectId, seq },
    'object_changed',
    historyPayload({
      source: 'ui',
      changes: [
        {
          field: 'accounting_object_id',
          from: document.accounting_object_id,
          to: accountingObjectId,
          from_label: labels?.fromObjectName ?? '',
          to_label: labels?.toObjectName ?? '',
        },
        { field: 'seq', from: document.seq, to: seq },
      ],
    }),
  );
  return updated;
}

/** Отмечает оплату документа отменённой/возобновлённой, при отмене сбрасывает статусы. */
export async function markPaymentCancelled(
  document: IDocument,
  cancelled: boolean,
): Promise<IDocument> {
  const payload: Partial<IDocument> = {
    payment_cancelled: cancelled,
    ...(cancelled ? { provided: false, confirmed: false, confirmed_file_id: '' } : {}),
  };
  const changes: DocumentHistoryChange[] = [
    { field: 'payment_cancelled', from: document.payment_cancelled, to: cancelled },
  ];
  if (cancelled) {
    pushChange(changes, 'provided', document.provided, false);
    pushChange(changes, 'confirmed', document.confirmed, false);
    pushChange(changes, 'confirmed_file_id', document.confirmed_file_id ?? '', '', {
      from_label: document.confirmed_file_id ?? '',
      to_label: '',
    });
  }
  return updateDocumentWithHistory(
    document,
    payload,
    cancelled ? 'payment_cancelled' : 'payment_resumed',
    historyPayload({ source: 'ui', changes }),
  );
}
