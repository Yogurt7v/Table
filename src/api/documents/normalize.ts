/** Нормализация записей документов и связанных сущностей из PocketBase. */

import type { IDocument, IDocumentComment, IDocumentFile, IDocumentHistory } from '@/shared/types';
import { normalizePbDate, normalizeRelationId } from '@/shared/utils/normalize-invoice';

/** Приводит запись документа к ожидаемым типам и значениям по умолчанию. */
export function normalizeDocument(record: IDocument): IDocument {
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

/** Приводит запись файла документа к ожидаемым типам и значениям по умолчанию. */
export function normalizeDocumentFile(record: IDocumentFile): IDocumentFile {
  return {
    ...record,
    document_id: normalizeRelationId(record.document_id),
    organization_id: normalizeRelationId(record.organization_id),
    uploaded_by: record.uploaded_by ? normalizeRelationId(record.uploaded_by) : undefined,
    name: record.name || record.file,
  };
}

/** Приводит запись комментария документа к ожидаемым типам и значениям по умолчанию. */
export function normalizeDocumentComment(record: IDocumentComment): IDocumentComment {
  return {
    ...record,
    document_id: normalizeRelationId(record.document_id),
    organization_id: normalizeRelationId(record.organization_id),
    author: normalizeRelationId(record.author),
    author_name: record.author_name || '',
    text: record.text || '',
  };
}

/** Приводит запись истории документа к ожидаемым типам и значениям по умолчанию. */
export function normalizeDocumentHistory(record: IDocumentHistory): IDocumentHistory {
  return {
    ...record,
    document_id: normalizeRelationId(record.document_id),
    organization_id: normalizeRelationId(record.organization_id),
    author: record.author ? normalizeRelationId(record.author) : undefined,
    author_name: record.author_name || '',
    changed_at: record.changed_at || record.created || '',
    previous_data:
      record.previous_data && typeof record.previous_data === 'object' ? record.previous_data : {},
  };
}
