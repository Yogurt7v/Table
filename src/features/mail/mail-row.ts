import type { IIncomingMail, IOutgoingMail } from '@/shared/types';
import { toDateKey } from './mail-date';

/**
 * Плоская строка реестра. Таблица работает с ней, а не с `IIncomingMail |
 * IOutgoingMail`: у моделей разные имена полей, а колонки у них общие, и без
 * нормализации в каждой ячейке стоял бы тернарник по типу письма.
 */
export interface MailRow {
  id: string;
  seq: number | undefined;
  number: string;
  dateKey: string;
  counterparty: string;
  counterpartyNumber: string;
  subject: string;
  comment: string;
  responsibleName: string;
  deliveryMethod: IIncomingMail['delivery_method'];
  accountingObjectId: string;
  created: string | undefined;
  attachmentCount: number;
  createdByName: string;
  /** Отображаемые имена вложений; пуще, если вложений нет или имя пустое. */
  attachmentNames: string[];
}

/** Письмо любого регистра в том виде, в котором отдаёт PocketBase. */
export type MailRecord = Pick<
  IIncomingMail,
  | 'id'
  | 'seq'
  | 'date'
  | 'subject'
  | 'comment'
  | 'responsible_name'
  | 'delivery_method'
  | 'accounting_object_id'
  | 'created'
  | 'created_by_name'
> &
  (
    | Pick<IIncomingMail, 'sender' | 'number' | 'sender_outgoing_number'>
    | Pick<IOutgoingMail, 'recipient' | 'outgoing_number' | 'counterparty_incoming_number'>
  );

export function toMailRow(
  record: MailRecord,
  attachmentCount: number,
  attachmentNames: string[] = [],
): MailRow {
  const isIncoming = 'sender' in record;
  return {
    id: record.id,
    seq: record.seq,
    number: isIncoming ? (record.number ?? '') : record.outgoing_number,
    dateKey: toDateKey(record.date),
    counterparty: isIncoming ? record.sender : record.recipient,
    counterpartyNumber: isIncoming
      ? (record.sender_outgoing_number ?? '')
      : (record.counterparty_incoming_number ?? ''),
    subject: record.subject,
    comment: record.comment ?? '',
    responsibleName: record.responsible_name ?? '',
    deliveryMethod: record.delivery_method,
    accountingObjectId: record.accounting_object_id ?? '',
    created: record.created,
    createdByName: record.created_by_name ?? '',
    attachmentCount,
    attachmentNames,
  };
}
