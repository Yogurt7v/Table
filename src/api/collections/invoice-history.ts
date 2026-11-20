/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/invoice-history`:
 * реализация живёт в домене `@/features/invoices/api`.
 */

export {
  getInvoiceHistory,
  createInvoiceHistoryRecord,
  createPaymentMarkHistory,
} from '@/features/invoices/api/invoice-history';
