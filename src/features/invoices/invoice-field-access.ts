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
    canMarkPayment: role === 'boss',
    canViewPaymentMarks: role === 'boss' || role === 'moderator' || role === 'admin',
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
