import type { IPaymentMark } from '@/shared/types';

export const APPROVAL_MARK_STATUS = 'proposed' as const;
export const PARTIAL_MARK_STATUS = 'partial' as const;
export const PAID_MARK_STATUS = 'approved' as const;

export const PAYMENT_MARK_LABEL = 'Оплатить';
export const PARTIAL_MARK_LABEL = 'Частично';
export const APPROVAL_MARK_LABEL = 'Согласование';

export type PaymentMarkKind = 'approval' | 'partial' | 'payment';

export function getPaymentMarkKind(
  mark: Pick<IPaymentMark, 'status' | 'amount'>,
  invoiceAmount: number,
): PaymentMarkKind {
  if (mark.status === APPROVAL_MARK_STATUS) return 'approval';
  if (mark.status === PARTIAL_MARK_STATUS) return 'partial';
  // Легаси-отметки без статуса: без суммы их создавала только частичная оплата,
  // а сумма меньше суммы счёта также означает частичную оплату.
  if (!mark.status || mark.status === PAID_MARK_STATUS) {
    if (mark.amount == null || mark.amount === 0) return 'partial';
    if (mark.amount !== invoiceAmount) return 'partial';
  }
  return 'payment';
}

export function paymentMarkLabel(
  mark: Pick<IPaymentMark, 'status' | 'amount'>,
  invoiceAmount: number,
): string {
  switch (getPaymentMarkKind(mark, invoiceAmount)) {
    case 'approval':
      return APPROVAL_MARK_LABEL;
    case 'partial':
      return PARTIAL_MARK_LABEL;
    default:
      return PAYMENT_MARK_LABEL;
  }
}