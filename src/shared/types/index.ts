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
}

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
  paid_date: string;
  comment: string;
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
  | 'payment_mark';

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
}

export interface IInvoiceHistory {
  id: string;
  invoice_id: string;
  author: string;
  changed_at: string;
  previous_data: Record<string, unknown>;
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
  created_by: string;
  created: string;
  expand?: {
    created_by?: IUser;
  };
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
