import type { IInvoice } from '@/shared/types';

export interface InvoicePaymentInfo {
  amounts: number[];
  totalPaid: number;
  remaining: number;
  hasCopies: boolean;
  hasRemainder: boolean;
}

export function getInvoicePaymentInfo(invoice: IInvoice): InvoicePaymentInfo {
  const amounts = invoice.payment_amounts ?? [];
  const totalPaid = amounts.reduce((s, a) => s + a, 0);
  const remaining = invoice.amount - totalPaid;
  return {
    amounts,
    totalPaid,
    remaining,
    hasCopies: amounts.length > 1,
    hasRemainder: totalPaid > 0 && remaining > 0,
  };
}

function cloneForDisplay(invoice: IInvoice, overrides: Partial<IInvoice>): IInvoice {
  return {
    ...invoice,
    paid_amount: null,
    payment_amounts: [],
    paid_date: null,
    ...overrides,
  };
}

export function createPaymentCopyInvoices(invoice: IInvoice): IInvoice[] {
  const { amounts } = getInvoicePaymentInfo(invoice);
  if (amounts.length <= 1) return [];
  const copies: IInvoice[] = [];
  for (let i = 1; i < amounts.length; i++) {
    const copyAmt = amounts[i]!;
    copies.push(
      cloneForDisplay(invoice, {
        id: `${invoice.id}__p${i - 1}`,
        amount: copyAmt,
        paid: true,
      }),
    );
  }
  return copies;
}

export function createRemainderInvoice(invoice: IInvoice): IInvoice | null {
  const { totalPaid, remaining } = getInvoicePaymentInfo(invoice);
  if (totalPaid <= 0 || remaining <= 0) return null;
  return cloneForDisplay(invoice, {
    id: `${invoice.id}__r`,
    amount: remaining,
    paid: false,
  });
}

export function filterPaidInvoiceForRemainder(invoice: IInvoice): IInvoice | null {
  if (!invoice.paid) return invoice;
  const { amounts, remaining } = getInvoicePaymentInfo(invoice);
  if (amounts.length === 0) return null;
  if (remaining <= 0) return null;
  return cloneForDisplay(invoice, {
    amount: remaining,
    paid: false,
  });
}
