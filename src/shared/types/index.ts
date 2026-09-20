export interface IOrganization {
  id: string;
  name: string;
  color: string;
}

export interface IBankAccount {
  id: string;
  organization_id: string;
  account_number: string;
}

export interface IBalanceHistory {
  id: string;
  account_id: string;
  date: string;
  balance: number;
}

export interface IAccountWithBalance {
  account: IBankAccount;
  balance: number;
}

export interface IAccountingObject {
  id: string;
  organization_id: string;
  name: string;
  sort?: number;
  counterparty_order?: string[];
}

export type PaymentMarkStatus = 'proposed' | 'approved' | 'partial';

export interface IInvoice {
  id: string;
  organization_id: string;
  accounting_object_id: string;
  date: string;
  seq: number;
  counterparty: string;
  purpose: string;
  contract_no: string;
  invoice_no: string;
  amount: number;
  paid: boolean;
  paid_amount: number | null;
  payment_amounts: number[];
  paid_date: string;
  comment: string;
  copy_comments: Record<string, string>;
  created_by: string;
  updated_by: string;
  created_by_name?: string;
  updated_by_name?: string;
  original_invoice_id?: string;
  source_paid_amount: number;
  source_paid_date: string;
  source_created?: string;
  last_deleted_mark?: {
    amount: number | null;
    comment: string;
    status: PaymentMarkStatus;
  } | null;
  created?: string;
}

export type InvoiceColumnId =
  | 'counterparty'
  | 'purpose'
  | 'contract_no'
  | 'invoice_no'
  | 'amount'
  | 'paid'
  | 'paid_date'
  | 'comment'
  | 'files'
  | 'actions'
  | 'payment_mark'
  | 'initiator';

export interface IUserSetting {
  id: string;
  user_id: string;
  key: string;
  value: unknown;
}

export interface IInvoiceFile {
  id: string;
  invoice_id: string;
  organization_id: string;
  file: string;
  name: string;
  created?: string;
  is_deleted?: boolean;
  deleted_at?: string;
}

export type InvoiceHistoryType =
  | ''
  | 'mark_created'
  | 'mark_deleted'
  | 'copy_created'
  | 'file_added'
  | 'file_removed'
  | 'invoice_deleted'
  | 'invoice_restored';

export interface IInvoiceHistory {
  id: string;
  invoice_id: string;
  author: string;
  changed_at: string;
  previous_data: Record<string, unknown>;
  type?: InvoiceHistoryType;
}

export interface IOrganizationUser {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'admin' | 'moderator' | 'user' | 'guest' | 'boss';
  objects?: string[];
  expand?: {
    user_id?: IUser;
    organization_id?: IOrganization;
  };
}

export interface IPaymentMark {
  id: string;
  invoice_id: string;
  organization_id: string;
  amount: number | null;
  comment: string;
  status?: PaymentMarkStatus;
  created_by: string;
  created: string;
  expand?: {
    created_by?: IUser;
  };
}

export interface INotification {
  id: string;
  organization_id: string;
  user_id: string;
  invoice_id: string;
  type:
    | 'invoice_created'
    | 'invoice_updated'
    | 'payment_marked'
    | 'invoice_restored'
    | 'invoice_deleted';
  event: string;
  message: string;
  actor_name: string;
  object_name?: string;
  amount?: number;
  paid?: boolean;
  invoice_date?: string;
  read: boolean;
  created: string;
}

export interface IDeletedInvoice {
  id: string;
  original_id: string;
  organization_id: string;
  accounting_object_id: string;
  date: string;
  seq: number;
  counterparty: string;
  purpose: string;
  contract_no: string;
  invoice_no: string;
  amount: number;
  paid: boolean;
  paid_date: string;
  paid_amount: number | null;
  payment_amounts: number[];
  comment: string;
  copy_comments: Record<string, string>;
  created_by: string;
  updated_by: string;
  created_by_name?: string;
  updated_by_name?: string;
  original_invoice_id: string;
  source_paid_amount: number;
  source_paid_date: string;
  source_created: string;
  deleted_by: string;
  deleted_by_name: string;
  deleted_at: string;
  created: string;
  expand?: {
    accounting_object_id?: IAccountingObject;
  };
}

export interface IDeletedInvoiceHistory {
  id: string;
  deleted_invoice_id: string;
  author: string;
  changed_at: string;
  previous_data: Record<string, unknown>;
  type: string;
}

export interface IDeletedInvoiceFile {
  id: string;
  deleted_invoice_id: string;
  name: string;
  file: string;
  original_file_id: string;
  created?: string;
}

export interface IUser {
  id: string;
  email: string;
  login: string;
  name: string;
  avatar: string;
  verified: boolean;
  created: string;
  updated: string;
}
