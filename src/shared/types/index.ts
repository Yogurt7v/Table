export interface IOrganization {
  id: string;
  name: string;
  color: string;
}

export interface IBankAccount {
  id: string;
  organization_id: string;
  account_number: string;
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
  role: 'admin' | 'moderator' | 'user' | 'guest';
}
