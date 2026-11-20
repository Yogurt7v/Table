/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/invoices-archive`:
 * реализация живёт в домене `@/features/invoices/api`.
 */

export {
  ARCHIVE_PAGE_SIZE,
  deleteInvoice,
  getDeletedInvoices,
  getDeletedInvoiceById,
  getDeletedInvoiceByOriginalId,
  getAllDeletedInvoices,
  getDeletedInvoiceHistory,
  getDeletedInvoiceFiles,
  getDeletedInvoiceFileUrl,
  restoreDeletedInvoice,
} from '@/features/invoices/api/invoices-archive';
