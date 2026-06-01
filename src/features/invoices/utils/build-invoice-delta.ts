import type { IInvoice } from '@/shared/types';
import type { DraftInvoiceForm } from '../invoice-field-access';

export interface InvoiceDelta {
  updates: Record<string, unknown>;
  previousData: Record<string, unknown>;
  changed: boolean;
}

export function buildInvoiceDelta(
  data: DraftInvoiceForm,
  original: IInvoice,
  defaultDate: string,
): InvoiceDelta {
  const updates: Record<string, unknown> = {};
  let changed = false;

  if (data.counterparty !== original.counterparty) {
    updates.counterparty = data.counterparty.trim();
    changed = true;
  }
  if (data.purpose !== original.purpose) {
    updates.purpose = data.purpose.trim();
    changed = true;
  }
  if (data.contract_no !== (original.contract_no || '')) {
    updates.contract_no = data.contract_no.trim();
    changed = true;
  }
  if (data.invoice_no !== original.invoice_no) {
    updates.invoice_no = data.invoice_no.trim();
    changed = true;
  }
  if (data.amount !== original.amount) {
    updates.amount = data.amount;
    changed = true;
  }
  if (data.paid !== original.paid) {
    updates.paid = data.paid;
    if (data.paid && !original.paid) {
      updates.paid_date = data.paid_date || defaultDate;
    }
    changed = true;
  }
  if (data.paid_date !== (original.paid_date || '')) {
    updates.paid_date = data.paid_date;
    changed = true;
  }
  if (data.comment !== (original.comment || '')) {
    updates.comment = data.comment.trim();
    changed = true;
  }

  const previousData: Record<string, unknown> = {};
  Object.keys(updates).forEach((key) => {
    if (key in original) {
      previousData[key] = original[key as keyof IInvoice];
    }
  });

  return { updates, previousData, changed };
}
