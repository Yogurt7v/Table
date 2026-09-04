import type { IOrganizationUser } from '@/shared/types';

export type OrgRole = IOrganizationUser['role'] | null;

export type InvoiceEditableField =
  | 'counterparty'
  | 'purpose'
  | 'contract_no'
  | 'invoice_no'
  | 'amount'
  | 'comment'
  | 'paid'
  | 'paid_date';

export const DRAFT_INVOICE_ID = '__draft__';

export function getInvoicePermissions(role: OrgRole) {
  return {
    canCreate: role === 'admin' || role === 'moderator' || role === 'user',
    canUpdate: role === 'admin' || role === 'moderator' || role === 'user',
    canDelete: role === 'admin' || role === 'moderator',
    canMove: role === 'admin' || role === 'moderator',
    canViewHistory: role === 'admin' || role === 'moderator',
    canManageFiles: role === 'admin' || role === 'moderator' || role === 'user',
    canPay: role === 'admin' || role === 'moderator',
    canMarkPayment: role === 'boss',
    canViewPaymentMarks: role === 'boss' || role === 'moderator' || role === 'admin',
    canViewPaidDate: role !== 'boss',
  };
}

export function canEditInvoiceField(role: OrgRole, field: InvoiceEditableField): boolean {
  if (!getInvoicePermissions(role).canUpdate) return false;
  if (field === 'paid' || field === 'paid_date') {
    return role === 'admin' || role === 'moderator';
  }
  return true;
}

export interface DraftInvoiceForm {
  counterparty: string;
  purpose: string;
  contract_no: string;
  invoice_no: string;
  amount: number;
  paid: boolean;
  paid_date: string;
  comment: string;
  file: File | null;
}

export function createEmptyDraft(): DraftInvoiceForm {
  return {
    counterparty: '',
    purpose: '',
    contract_no: '',
    invoice_no: '',
    amount: 0,
    paid: false,
    paid_date: '',
    comment: '',
    file: null,
  };
}

export function validateDraftForm(form: DraftInvoiceForm): string | null {
  if (!form.counterparty.trim()) return 'Укажите контрагента';
  if (!form.purpose.trim()) return 'Укажите назначение платежа';
  if (!form.invoice_no.trim()) return 'Укажите номер счёта';
  if (form.amount == null || Number.isNaN(form.amount) || form.amount <= 0) {
    return 'Укажите сумму больше 0';
  }
  return null;
}

export type DraftFieldErrorKey = 'counterparty' | 'purpose' | 'invoice_no' | 'amount';

export type DraftFieldErrors = Partial<Record<DraftFieldErrorKey, string>>;

export function validateDraftFields(form: DraftInvoiceForm): DraftFieldErrors {
  const errors: DraftFieldErrors = {};
  if (!form.counterparty.trim()) errors.counterparty = 'Укажите контрагента';
  if (!form.purpose.trim()) errors.purpose = 'Укажите назначение платежа';
  if (!form.invoice_no.trim()) errors.invoice_no = 'Укажите номер счёта';
  if (form.amount == null || Number.isNaN(form.amount) || form.amount <= 0) {
    errors.amount = 'Сумма должна быть больше 0';
  }
  return errors;
}

export function isDraftDirty(form: DraftInvoiceForm): boolean {
  if (
    form.counterparty !== '' ||
    form.purpose !== '' ||
    form.contract_no !== '' ||
    form.invoice_no !== '' ||
    form.comment !== ''
  ) {
    return true;
  }
  const rawAmount: unknown = form.amount;
  const amount =
    typeof rawAmount === 'string' ? parseFloat(rawAmount.replace(',', '.')) : rawAmount;
  if (amount != null && !Number.isNaN(amount) && amount !== 0) return true;
  if (form.paid !== false || form.paid_date !== '') return true;
  return form.file != null;
}
