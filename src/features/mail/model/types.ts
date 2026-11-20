/** Типы домена почтовой корреспонденции: письма, файлы, история, связи, архив и права. */

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

/** Названия способов доставки. */
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
