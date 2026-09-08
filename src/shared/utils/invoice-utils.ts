import type { IInvoice } from '@/shared/types';

/** Эффективная сумма для отображения:
 *  оплаченный счёт показывает сумму оплат, неоплаченный — базовую сумму. */
export function getEffectiveAmount(invoice: IInvoice): number {
  return invoice.paid && invoice.payment_amounts?.length
    ? invoice.payment_amounts.reduce((s, a) => s + a, 0)
    : invoice.amount;
}
