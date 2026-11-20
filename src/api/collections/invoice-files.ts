/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/invoice-files`:
 * реализация живёт в домене `@/features/invoices/api`.
 */

export {
  getInvoiceFilesByOrg,
  getInvoiceFiles,
  createInvoiceFile,
  softDeleteInvoiceFile,
  getInvoiceFileUrl,
  getInvoiceFileDownloadUrl,
} from '@/features/invoices/api/invoice-files';
