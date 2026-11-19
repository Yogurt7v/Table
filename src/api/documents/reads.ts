/** Чтение документов, файлов, комментариев, истории и вспомогательные выборки. */

import { pb } from '../client.ts';
import type {
  IDocument,
  IDocumentComment,
  IDocumentFile,
  IDocumentHistory,
  IInvoice,
} from '@/shared/types';
import { foldSearchText } from '@/shared/utils/search-text';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import {
  DOCUMENT_COMMENTS_COLLECTION,
  DOCUMENT_FILES_COLLECTION,
  DOCUMENT_HISTORY_COLLECTION,
  DOCUMENTS_COLLECTION,
} from './constants.ts';
import {
  normalizeDocument,
  normalizeDocumentComment,
  normalizeDocumentFile,
  normalizeDocumentHistory,
} from './normalize.ts';
import { qTag } from './shared.ts';

/** Возвращает список документов организации с учётом роли и флага удалённых. */
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

/** Возвращает архив (удалённые) документы организации. */
export async function getArchivedDocuments(organizationId: string): Promise<IDocument[]> {
  const records = await pb.collection(DOCUMENTS_COLLECTION).getFullList<IDocument>({
    filter: `organization_id = "${qTag(organizationId)}" && is_deleted = true`,
    sort: '-deleted_at,-seq',
  });
  return records.map(normalizeDocument);
}

/** Возвращает документ по идентификатору. */
export async function getDocumentById(id: string): Promise<IDocument> {
  return normalizeDocument(await pb.collection(DOCUMENTS_COLLECTION).getOne<IDocument>(id));
}

/** Возвращает файлы документа. */
export async function getDocumentFiles(documentId: string): Promise<IDocumentFile[]> {
  const records = await pb.collection(DOCUMENT_FILES_COLLECTION).getFullList<IDocumentFile>({
    filter: `document_id = "${qTag(documentId)}"`,
    sort: 'created',
  });
  return records.map(normalizeDocumentFile);
}

/** Возвращает все файлы документов организации. */
export async function getAllDocumentFiles(organizationId: string): Promise<IDocumentFile[]> {
  const records = await pb.collection(DOCUMENT_FILES_COLLECTION).getFullList<IDocumentFile>({
    filter: `organization_id = "${qTag(organizationId)}"`,
    sort: 'created',
  });
  return records.map(normalizeDocumentFile);
}

/** Возвращает все комментарии документов организации. */
export async function getAllDocumentComments(organizationId: string): Promise<IDocumentComment[]> {
  const records = await pb.collection(DOCUMENT_COMMENTS_COLLECTION).getFullList<IDocumentComment>({
    filter: `organization_id = "${qTag(organizationId)}"`,
    sort: 'created',
  });
  return records.map(normalizeDocumentComment);
}

/** Возвращает счета организации (для подстановки/связей с документами). */
export async function getOrgInvoices(organizationId: string): Promise<IInvoice[]> {
  return pb.collection('invoices').getFullList<IInvoice>({
    filter: `organization_id = "${qTag(organizationId)}"`,
    sort: '-date,-seq',
  });
}

/** Возвращает комментарии документа. */
export async function getDocumentComments(documentId: string): Promise<IDocumentComment[]> {
  const records = await pb.collection(DOCUMENT_COMMENTS_COLLECTION).getFullList<IDocumentComment>({
    filter: `document_id = "${qTag(documentId)}"`,
    sort: 'created',
  });
  return records.map(normalizeDocumentComment);
}

/** Возвращает историю изменений документа (от новых к старым). */
export async function getDocumentHistory(documentId: string): Promise<IDocumentHistory[]> {
  const records = await pb.collection(DOCUMENT_HISTORY_COLLECTION).getFullList<IDocumentHistory>({
    filter: `document_id = "${qTag(documentId)}"`,
    sort: '-changed_at,-created',
  });
  return records.map(normalizeDocumentHistory);
}

/** Возвращает следующий порядковый номер документа в объекте учёта. */
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

/** Ищет идентификаторы документов по тексту комментариев (свёрнутый поиск). */
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
