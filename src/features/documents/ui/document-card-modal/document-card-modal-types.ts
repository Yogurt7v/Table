import type { IAccountingObject, IUser } from '@/shared/types';
import type { OrgRole } from '@/features/invoices/invoice-field-access';

/** Пропсы модалки карточки документа. */
export interface DocumentCardModalProps {
  documentId: string | null;
  opened: boolean;
  onClose: () => void;
  organizationId: string;
  role: OrgRole;
  currentUserId: string | undefined;
  objects: IAccountingObject[];
  users: IUser[];
  initialTab?: 'document' | 'files' | 'comments' | 'history';
}

/** Копия реквизитов документа, которую правит пользователь в модалке. */
export interface DocumentForm {
  accounting_object_id: string;
  payment_date: string;
  counterparty: string;
  purpose: string;
  contract_no: string;
  invoice_no: string;
  amount: number;
  responsible_id: string;
}
