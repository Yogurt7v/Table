/**
 * Публичный API документов: barrel-реэкспорт констант, типов и функций из `src/features/documents/api/*`.
 * Сохранён состав экспортов исходного монолита; путь `@/api/documents` реэкспортирует этот barrel.
 */

export {
  DOCUMENTS_COLLECTION,
  DOCUMENT_FILES_COLLECTION,
  DOCUMENT_COMMENTS_COLLECTION,
  DOCUMENT_HISTORY_COLLECTION,
} from './constants.ts';

export {
  listDocuments,
  getArchivedDocuments,
  getDocumentById,
  getDocumentFiles,
  getAllDocumentFiles,
  getAllDocumentComments,
  getOrgInvoices,
  getDocumentComments,
  getDocumentHistory,
  getNextDocumentSeq,
  searchDocumentIdsByComment,
} from './reads.ts';

export { createDocumentHistory, buildDocumentHistoryPayload } from './history.ts';

export type { CreateDocumentInput } from './writes.ts';
export {
  createManualDocument,
  updateDocumentWithHistory,
  updateDocumentStatus,
  uploadDocumentFile,
  deleteDocumentFile,
  addDocumentComment,
  deleteDocumentComment,
  archiveDocument,
  restoreDocument,
  moveDocument,
  markPaymentCancelled,
} from './writes.ts';

export { getDocumentFileUrl, getSourceInvoiceInfo } from './source.ts';
