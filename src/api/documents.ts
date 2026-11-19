/**
 * Публичный API документов: barrel-реэкспорт констант, типов и функций из `src/api/documents/*`.
 * Сохранён путь импорта `@/api/documents` и состав экспортов исходного монолита.
 */

export {
  DOCUMENTS_COLLECTION,
  DOCUMENT_FILES_COLLECTION,
  DOCUMENT_COMMENTS_COLLECTION,
  DOCUMENT_HISTORY_COLLECTION,
} from './documents/constants.ts';

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
} from './documents/reads.ts';

export { createDocumentHistory } from './documents/history.ts';

export type { CreateDocumentInput } from './documents/writes.ts';
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
} from './documents/writes.ts';

export { getDocumentFileUrl, getSourceInvoiceInfo } from './documents/source.ts';
