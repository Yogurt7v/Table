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
  // Authoritative mail permissions: the flag IS the effective permission (backfilled
  // per role). Optional so pre-mail fixtures and mocks keep compiling.
  can_view_mails?: boolean;
  can_create_incoming_mails?: boolean;
  can_edit_incoming_mails?: boolean;
  can_delete_incoming_mails?: boolean;
  can_create_outgoing_mails?: boolean;
  can_edit_outgoing_mails?: boolean;
  can_delete_outgoing_mails?: boolean;
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

// --- Mail correspondence ---

export type MailType = 'incoming' | 'outgoing';

export type DeliveryMethod = 'email' | 'post' | 'courier' | 'messenger';

export type MailHistoryType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'linked'
  | 'unlinked';

  /** Эмодзи способов доставки для компактного отображения в таблице/карточках. */
  export const MAIL_DELIVERY_METHOD_EMOJI: Record<DeliveryMethod, string> = {
    email: '🌐',
    post: '📨',
    courier: '🚚',
    messenger: '📱',
  };

  export const MAIL_DELIVERY_METHOD_NAMES: Record<DeliveryMethod, string> = {
    email: 'Email',
    post: 'Почта',
    courier: 'Курьер',
    messenger: 'Мессенджер',
  };

/** `created_by`/`updated_by` hold user ids, not relations — the name is snapshotted. */
export interface IMailActorFields {
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
}

export interface IIncomingMail extends IMailActorFields {
  id: string;
  organization_id: string;
  accounting_object_id?: string;
  seq?: number;
  number?: string;
  date: string;
  sender_outgoing_number?: string;
  subject: string;
  sender: string;
  responsible: string;
  responsible_name?: string;
  delivery_method?: DeliveryMethod;
  comment?: string;
  created?: string;
  updated?: string;
}

export interface IOutgoingMail extends IMailActorFields {
  id: string;
  organization_id: string;
  accounting_object_id?: string;
  seq?: number;
  date: string;
  outgoing_number: string;
  counterparty_incoming_number?: string;
  subject: string;
  recipient: string;
  responsible: string;
  responsible_name?: string;
  delivery_method?: DeliveryMethod;
  comment?: string;
  created?: string;
  updated?: string;
}

/** `mail_id` is text, not a relation, so attachments survive archive + restore. */
export interface IMailFile {
  id: string;
  mail_id: string;
  mail_type: MailType;
  organization_id: string;
  file: string[];
  name: string;
  created_by?: string;
  created_by_name?: string;
  created?: string;
}

export interface IMailHistory {
  id: string;
  incoming_mail_id?: string;
  outgoing_mail_id?: string;
  organization_id: string;
  author: string;
  author_name?: string;
  changed_at: string;
  type: MailHistoryType;
  previous_data: Record<string, unknown>;
  created?: string;
  updated?: string;
}

/** Exactly two of the four id fields are set, one per side, picked by `MailType`. */
export interface IMailRelation {
  id: string;
  parent_incoming_mail_id?: string;
  parent_outgoing_mail_id?: string;
  child_incoming_mail_id?: string;
  child_outgoing_mail_id?: string;
  organization_id: string;
  created_by?: string;
  created_by_name?: string;
  created?: string;
}

export interface IDeletedMailBase {
  original_id: string;
  organization_id: string;
  accounting_object_id?: string;
  seq?: number;
  date: string;
  subject: string;
  responsible: string;
  responsible_name?: string;
  delivery_method?: DeliveryMethod;
  comment?: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
  deleted_by: string;
  deleted_by_name: string;
  deleted_at: string;
  created?: string;
}

export interface IDeletedIncomingMail extends IDeletedMailBase {
  id: string;
  number?: string;
  sender_outgoing_number?: string;
  sender: string;
}

export interface IDeletedOutgoingMail extends IDeletedMailBase {
  id: string;
  outgoing_number: string;
  counterparty_incoming_number?: string;
  recipient: string;
}

export interface IDeletedMailHistory {
  id: string;
  deleted_incoming_mail_id?: string;
  deleted_outgoing_mail_id?: string;
  organization_id: string;
  author: string;
  author_name?: string;
  changed_at: string;
  type: MailHistoryType;
  previous_data: Record<string, unknown>;
  created?: string;
}

/** One endpoint of a link: which register the id belongs to. */
export interface MailRelationSide {
  id: string;
  type: MailType;
}

export interface MailListParams {
  organizationId: string;
  page?: number;
  perPage?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  accountingObjectIds?: string[];
  withoutAccountingObject?: boolean;
  deliveryMethods?: DeliveryMethod[];
  withoutDeliveryMethod?: boolean;
  responsibleIds?: string[];
  /** Sender for incoming mails, recipient for outgoing ones. */
  counterparty?: string;
  withFiles?: boolean;
  hasRelations?: boolean;
  sort?: string;
}

export interface MailPermissionFlags {
  can_view_mails: boolean;
  can_create_incoming_mails: boolean;
  can_edit_incoming_mails: boolean;
  can_delete_incoming_mails: boolean;
  can_create_outgoing_mails: boolean;
  can_edit_outgoing_mails: boolean;
  can_delete_outgoing_mails: boolean;
}
