/** Создание и обновление писем (входящие/исходящие) с записью истории. */

import { pb } from '../client.ts';
import type { DeliveryMethod, IIncomingMail, IOutgoingMail } from '@/shared/types';
import { MAIL_INCOMING_COLLECTION, MAIL_OUTGOING_COLLECTION } from './constants.ts';
import { createMailHistory } from './history.ts';
import { currentActorId, currentActorName } from './shared.ts';

/** Входные данные для создания входящего письма. */
export type CreateIncomingMailInput = {
  organization_id: string;
  date: string;
  subject: string;
  sender: string;
  responsible: string;
  accounting_object_id?: string;
  seq?: number;
  number?: string;
  sender_outgoing_number?: string;
  responsible_name?: string;
  delivery_method?: DeliveryMethod;
  comment?: string;
};

/** Входные данные для создания исходящего письма. */
export type CreateOutgoingMailInput = {
  organization_id: string;
  date: string;
  subject: string;
  recipient: string;
  responsible: string;
  outgoing_number: string;
  accounting_object_id?: string;
  seq?: number;
  counterparty_incoming_number?: string;
  responsible_name?: string;
  delivery_method?: DeliveryMethod;
  comment?: string;
};

/**
 * Creates an incoming mail. Actor fields are written here because the
 * actor-name hooks in notify.pb.js are scoped to the `invoices` collection.
 */
export function createIncomingMail(data: CreateIncomingMailInput) {
  const actorId = currentActorId();
  const actorName = currentActorName();
  return pb.collection(MAIL_INCOMING_COLLECTION).create<IIncomingMail>({
    organization_id: data.organization_id,
    date: data.date.slice(0, 10),
    subject: data.subject,
    sender: data.sender,
    responsible: data.responsible,
    accounting_object_id: data.accounting_object_id ?? '',
    seq: data.seq,
    number: data.number ?? '',
    sender_outgoing_number: data.sender_outgoing_number ?? '',
    responsible_name: data.responsible_name ?? actorName,
    delivery_method: data.delivery_method,
    comment: data.comment ?? '',
    created_by: actorId,
    created_by_name: actorName,
    updated_by: actorId,
    updated_by_name: actorName,
  });
}

/** Outgoing twin of `createIncomingMail`. */
export function createOutgoingMail(data: CreateOutgoingMailInput) {
  const actorId = currentActorId();
  const actorName = currentActorName();
  return pb.collection(MAIL_OUTGOING_COLLECTION).create<IOutgoingMail>({
    organization_id: data.organization_id,
    date: data.date.slice(0, 10),
    subject: data.subject,
    recipient: data.recipient,
    responsible: data.responsible,
    outgoing_number: data.outgoing_number,
    accounting_object_id: data.accounting_object_id ?? '',
    seq: data.seq,
    counterparty_incoming_number: data.counterparty_incoming_number ?? '',
    responsible_name: data.responsible_name ?? actorName,
    delivery_method: data.delivery_method,
    comment: data.comment ?? '',
    created_by: actorId,
    created_by_name: actorName,
    updated_by: actorId,
    updated_by_name: actorName,
  });
}

/**
 * Updates an incoming mail, writing the `mail_history` row first — the same
 * contract as updateInvoiceWithHistory: if the update fails the audit trail
 * still records the state the mail was in before the attempt. `organization_id`
 * is read off the record rather than taken from `data`, because mail_history
 * requires it and a caller updating one field must not have to resend it.
 */
export async function updateIncomingMail(
  id: string,
  data: Partial<IIncomingMail>,
  previousData: Record<string, unknown>,
) {
  const current = await pb
    .collection(MAIL_INCOMING_COLLECTION)
    .getOne<IIncomingMail>(id, { fields: 'organization_id' });

  await createMailHistory({
    mailId: id,
    mailType: 'incoming',
    organizationId: current.organization_id,
    previousData,
    type: 'updated',
  });

  const actorId = currentActorId();
  const actorName = currentActorName();
  return pb
    .collection(MAIL_INCOMING_COLLECTION)
    .update<IIncomingMail>(id, { ...data, updated_by: actorId, updated_by_name: actorName });
}

/** Outgoing twin of `updateIncomingMail`. */
export async function updateOutgoingMail(
  id: string,
  data: Partial<IOutgoingMail>,
  previousData: Record<string, unknown>,
) {
  const current = await pb
    .collection(MAIL_OUTGOING_COLLECTION)
    .getOne<IOutgoingMail>(id, { fields: 'organization_id' });

  await createMailHistory({
    mailId: id,
    mailType: 'outgoing',
    organizationId: current.organization_id,
    previousData,
    type: 'updated',
  });

  const actorId = currentActorId();
  const actorName = currentActorName();
  return pb
    .collection(MAIL_OUTGOING_COLLECTION)
    .update<IOutgoingMail>(id, { ...data, updated_by: actorId, updated_by_name: actorName });
}
