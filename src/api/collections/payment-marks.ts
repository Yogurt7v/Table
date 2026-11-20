/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/payment-marks`:
 * реализация живёт в домене `@/features/invoices/api`.
 */

export {
  getPaymentMarks,
  createPaymentMark,
  deletePaymentMark,
  approvePaymentMark,
} from '@/features/invoices/api/payment-marks';
