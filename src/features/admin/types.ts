/** Базовые сущности, управляемые в администрировании: организации, объекты учёта, пользователи, настройки и членства. */

export interface IOrganization {
  id: string;
  name: string;
  color: string;
}

export interface IAccountingObject {
  id: string;
  organization_id: string;
  name: string;
  sort?: number;
  counterparty_order?: string[];
  /** false — объект скрыт из реестра счетов (админ может вернуть через админку); почту флаг не затрагивает */
  is_active?: boolean;
}

export interface IUserSetting {
  id: string;
  user_id: string;
  key: string;
  value: unknown;
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
  // Module visibility flags, one per module the organization can turn off for a
  // particular user. Independent of role — even an admin without the flag sees a
  // stub instead of the module.
  can_view_invoices?: boolean;
  can_view_documents?: boolean;
  expand?: {
    user_id?: IUser;
    organization_id?: IOrganization;
  };
}
