import type { IIncomingMail, IOutgoingMail, MailType } from '@/shared/types';
import { toDateKey, todayDateKey } from './mail-date';

/**
 * Чистая часть формы письма: разбор записи в состояние, проверка полей и
 * снимок для `mail_history`. Вынесена из модалки, потому что тестируется без
 * рендера, а `react-refresh` всё равно не даёт смешивать компоненты и функции
 * в одном файле.
 */

export interface MailFormState {
  date: string;
  number: string;
  counterparty: string;
  counterpartyNumber: string;
  subject: string;
  responsible: string;
  accountingObjectId: string;
  deliveryMethod: DeliveryMethodOrNull;
  comment: string;
}

type DeliveryMethodOrNull = IIncomingMail['delivery_method'] | null;

export type MailFormErrorKey = 'date' | 'counterparty' | 'number' | 'subject' | 'responsible';

export type MailFormErrors = Partial<Record<MailFormErrorKey, string>>;

export function createEmptyMailForm(): MailFormState {
  return {
    date: todayDateKey(),
    number: '',
    counterparty: '',
    counterpartyNumber: '',
    subject: '',
    responsible: '',
    accountingObjectId: '',
    deliveryMethod: null,
    comment: '',
  };
}

function incomingToForm(mail: IIncomingMail): MailFormState {
  return {
    date: toDateKey(mail.date),
    number: mail.number ?? '',
    counterparty: mail.sender,
    counterpartyNumber: mail.sender_outgoing_number ?? '',
    subject: mail.subject,
    responsible: mail.responsible,
    accountingObjectId: mail.accounting_object_id ?? '',
    deliveryMethod: mail.delivery_method ?? null,
    comment: mail.comment ?? '',
  };
}

function outgoingToForm(mail: IOutgoingMail): MailFormState {
  return {
    date: toDateKey(mail.date),
    number: mail.outgoing_number,
    counterparty: mail.recipient,
    counterpartyNumber: mail.counterparty_incoming_number ?? '',
    subject: mail.subject,
    responsible: mail.responsible,
    accountingObjectId: mail.accounting_object_id ?? '',
    deliveryMethod: mail.delivery_method ?? null,
    comment: mail.comment ?? '',
  };
}

export function toMailForm(
  mailType: MailType,
  mail: IIncomingMail | IOutgoingMail | null,
  options?: { clearNumber?: boolean },
): MailFormState {
  if (!mail) return createEmptyMailForm();
  const form =
    mailType === 'incoming'
      ? incomingToForm(mail as IIncomingMail)
      : outgoingToForm(mail as IOutgoingMail);
  // Номер письма в реестре — зачастую уникальный (и для исходящих обязателен),
  // поэтому копия оставляет его пустым: так задвоиться невозможно в принципе.
  return options?.clearNumber ? { ...form, number: '' } : form;
}

/**
 * Продолжение формы при смене регистра во время копирования. Реквизиты письма
 * (дата, контрагент, тема, ответственный, объект учёта, способ доставки,
 * комментарий) в обоих реестрах значат одно и то же, поэтому переносятся как
 * есть. Номер — единственное исключение: у входящего это номер контрагента, а у
 * исходящего наш собственный исходящий номер, то есть в другом регистре прежнее
 * значение занимало бы не то же самое поле.
 */
export function carryOverForRegisterSwitch(form: MailFormState): MailFormState {
  return { ...form, number: '' };
}

export function validateMailForm(form: MailFormState, mailType: MailType): MailFormErrors {
  const errors: MailFormErrors = {};
  if (!form.date) errors.date = 'Укажите дату письма';
  if (!form.counterparty.trim()) errors.counterparty = 'Укажите отправителя или получателя';
  if (mailType === 'outgoing' && !form.number.trim()) errors.number = 'Укажите исходящий номер';
  if (!form.subject.trim()) errors.subject = 'Укажите тему письма';
  if (!form.responsible.trim()) errors.responsible = 'Укажите ответственного';
  return errors;
}

/** Снимок полей для `mail_history.previous_data` перед сохранением правки. */
export function snapshotForHistory(
  mailType: MailType,
  mail: IIncomingMail | IOutgoingMail,
): Record<string, unknown> {
  const record = { ...(mailType === 'incoming' ? mail : mail) } as Record<string, unknown>;
  const snapshot = { ...record };
  delete snapshot['id'];
  delete snapshot['organization_id'];
  return snapshot;
}
