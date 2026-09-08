import type { IInvoice, IPaymentMark } from '@/shared/types';
import { getInvoicePaymentInfo } from '@/features/invoices/utils/expand-invoice-rows';
import { getPaymentMarkKind } from '@/features/invoices/payment-mark-status';

export type InvoiceFilterType = 'paid' | 'unpaid' | 'partial' | 'payment_mark' | 'approval_mark';

export const INVOICE_FILTER_LABELS: Record<InvoiceFilterType, string> = {
  paid: 'Оплаченные',
  unpaid: 'Не оплаченные',
  partial: 'Частично оплаченные',
  payment_mark: 'К оплате',
  approval_mark: 'На согласовании',
};

export const ALL_INVOICE_FILTERS: InvoiceFilterType[] = [
  'unpaid',
  'paid',
  'payment_mark',
  'approval_mark',
  'partial',
];

export const REDUCED_INVOICE_FILTERS: InvoiceFilterType[] = ['unpaid', 'paid', 'partial'];

export function findInvoicePaymentMark(
  paymentMarks: IPaymentMark[] | undefined,
  invoiceId: string,
): IPaymentMark | undefined {
  return paymentMarks?.find((m) => m.invoice_id === invoiceId);
}

function matchFilter(
  invoice: IInvoice,
  mark: IPaymentMark | undefined,
  filter: InvoiceFilterType,
): boolean {
  const { amounts } = getInvoicePaymentInfo(invoice);
  switch (filter) {
    case 'paid':
      return invoice.paid === true;
    case 'unpaid':
      return invoice.paid === false && amounts.length === 0;
    case 'partial':
      return invoice.paid === false && amounts.length > 0;
    case 'payment_mark':
      return mark != null && getPaymentMarkKind(mark, invoice.amount) === 'payment';
    case 'approval_mark':
      return mark != null && getPaymentMarkKind(mark, invoice.amount) === 'approval';
  }
}

export function matchesInvoiceFilter(
  invoice: IInvoice,
  paymentMarks: IPaymentMark[] | undefined,
  activeFilters: InvoiceFilterType[],
): boolean {
  if (activeFilters.length === 0) return true;
  const mark = findInvoicePaymentMark(paymentMarks, invoice.id);
  return activeFilters.some((filter) => matchFilter(invoice, mark, filter));
}

export function filterInvoices(
  invoices: IInvoice[] | undefined,
  paymentMarks: IPaymentMark[] | undefined,
  activeFilters: InvoiceFilterType[],
): IInvoice[] {
  if (!invoices) return [];
  if (activeFilters.length === 0) return invoices;
  return invoices.filter((inv) => matchesInvoiceFilter(inv, paymentMarks, activeFilters));
}