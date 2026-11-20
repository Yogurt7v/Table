/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/invoices`:
 * реализация живёт в домене `@/features/invoices/api`.
 */

export type { CreateInvoiceInput } from '@/features/invoices/api/invoices';
export {
  getInvoices,
  getInvoice,
  countInvoicesByOrg,
  searchCounterparties,
  createInvoice,
  getInvoiceCopies,
  getRootOriginalCreated,
  syncInvoiceCopy,
  updateInvoice,
  updateInvoiceWithHistory,
  getInvoiceHistoryChain,
  getAllInvoices,
  findDuplicateInvoices,
} from '@/features/invoices/api/invoices';
