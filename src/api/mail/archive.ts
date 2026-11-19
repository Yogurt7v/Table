/** Удаление писем в архив и чтение архивных реестров. */

import type { ListResult } from 'pocketbase';
import { pb } from '../client.ts';
import type {
  IDeletedIncomingMail,
  IDeletedMailHistory,
  IDeletedOutgoingMail,
  IIncomingMail,
  IOutgoingMail,
  MailListParams,
} from '@/shared/types';
import { appendDeletionReason } from '@/shared/utils/deletion-reason';
import {
  ARCHIVE_MAIL_PAGE_SIZE,
  ARCHIVE_MAIL_SORT,
  DELETED_MAIL_HISTORY_COLLECTION,
  DELETED_MAIL_INCOMING_COLLECTION,
  DELETED_MAIL_OUTGOING_COLLECTION,
  MAIL_INCOMING_COLLECTION,
  MAIL_OUTGOING_COLLECTION,
} from './constants.ts';
import { buildDeletedIncomingMailFilter, buildDeletedOutgoingMailFilter } from './filters.ts';
import { currentActorId, currentActorName, qTag } from './shared.ts';

/**
 * Archives an incoming mail and deletes the original — the same three-step
 * order deleteInvoice uses (archive row first, because the archive history row
 * needs its id, then delete).
 *
 * `mail_history` and `mail_relations` rows are NOT touched: every one of their
 * four relation fields is a real relation with cascadeDelete, so they go with
 * the mail itself. `mail_files` rows are deliberately left in place — mail_id
 * is plain text, not a relation, so the attachments outlive the delete and stay
 * openable from the archive. That is the reason for the polymorphic pair.
 *
 * `reason` обязателен: строка причины дописывается последней строкой в `comment`
 * архивной записи, потому что архив — единственное, что переживает удаление.
 * Отдельного поля у причины нет (миграция `delete_reason` отклонена), поэтому
 * `restoreDeletedIncomingMail` снимает эту строку обратно.
 */
export async function deleteIncomingMail(id: string, reason: string) {
  const mail = await pb.collection(MAIL_INCOMING_COLLECTION).getOne<IIncomingMail>(id);
  const deletedBy = currentActorId();
  const deletedByName = currentActorName();
  const deletedAt = new Date().toISOString();

  const archived = await pb
    .collection(DELETED_MAIL_INCOMING_COLLECTION)
    .create<IDeletedIncomingMail>({
      original_id: mail.id,
      organization_id: mail.organization_id,
      accounting_object_id: mail.accounting_object_id ?? '',
      seq: mail.seq,
      number: mail.number ?? '',
      date: mail.date,
      sender_outgoing_number: mail.sender_outgoing_number ?? '',
      subject: mail.subject,
      sender: mail.sender,
      responsible: mail.responsible,
      responsible_name: mail.responsible_name ?? '',
      delivery_method: mail.delivery_method,
      comment: appendDeletionReason(mail.comment, reason),
      created_by: mail.created_by ?? '',
      created_by_name: mail.created_by_name ?? '',
      updated_by: mail.updated_by ?? '',
      updated_by_name: mail.updated_by_name ?? '',
      deleted_by: deletedBy,
      deleted_by_name: deletedByName,
      deleted_at: deletedAt,
    });

  await pb.collection(DELETED_MAIL_HISTORY_COLLECTION).create<IDeletedMailHistory>({
    deleted_incoming_mail_id: archived.id,
    organization_id: mail.organization_id,
    author: deletedBy,
    author_name: deletedByName,
    changed_at: deletedAt,
    previous_data: {
      deleted_by: deletedBy,
      deleted_by_name: deletedByName,
      deleted_at: deletedAt,
    },
    type: 'deleted',
  });

  return pb.collection(MAIL_INCOMING_COLLECTION).delete(id);
}

/** Outgoing twin of `deleteIncomingMail`. */
export async function deleteOutgoingMail(id: string, reason: string) {
  const mail = await pb.collection(MAIL_OUTGOING_COLLECTION).getOne<IOutgoingMail>(id);
  const deletedBy = currentActorId();
  const deletedByName = currentActorName();
  const deletedAt = new Date().toISOString();

  const archived = await pb
    .collection(DELETED_MAIL_OUTGOING_COLLECTION)
    .create<IDeletedOutgoingMail>({
      original_id: mail.id,
      organization_id: mail.organization_id,
      accounting_object_id: mail.accounting_object_id ?? '',
      seq: mail.seq,
      outgoing_number: mail.outgoing_number,
      date: mail.date,
      counterparty_incoming_number: mail.counterparty_incoming_number ?? '',
      subject: mail.subject,
      recipient: mail.recipient,
      responsible: mail.responsible,
      responsible_name: mail.responsible_name ?? '',
      delivery_method: mail.delivery_method,
      comment: appendDeletionReason(mail.comment, reason),
      created_by: mail.created_by ?? '',
      created_by_name: mail.created_by_name ?? '',
      updated_by: mail.updated_by ?? '',
      updated_by_name: mail.updated_by_name ?? '',
      deleted_by: deletedBy,
      deleted_by_name: deletedByName,
      deleted_at: deletedAt,
    });

  await pb.collection(DELETED_MAIL_HISTORY_COLLECTION).create<IDeletedMailHistory>({
    deleted_outgoing_mail_id: archived.id,
    organization_id: mail.organization_id,
    author: deletedBy,
    author_name: deletedByName,
    changed_at: deletedAt,
    previous_data: {
      deleted_by: deletedBy,
      deleted_by_name: deletedByName,
      deleted_at: deletedAt,
    },
    type: 'deleted',
  });

  return pb.collection(MAIL_OUTGOING_COLLECTION).delete(id);
}

/** Paginated archive of deleted incoming mails, most recently deleted first. */
export function getDeletedIncomingMails(
  params: MailListParams,
): Promise<ListResult<IDeletedIncomingMail>> {
  return pb
    .collection(DELETED_MAIL_INCOMING_COLLECTION)
    .getList<IDeletedIncomingMail>(params.page ?? 1, params.perPage ?? ARCHIVE_MAIL_PAGE_SIZE, {
      filter: buildDeletedIncomingMailFilter(params),
      sort: params.sort ?? ARCHIVE_MAIL_SORT,
    });
}

/** Outgoing twin of `getDeletedIncomingMails`. */
export function getDeletedOutgoingMails(
  params: MailListParams,
): Promise<ListResult<IDeletedOutgoingMail>> {
  return pb
    .collection(DELETED_MAIL_OUTGOING_COLLECTION)
    .getList<IDeletedOutgoingMail>(params.page ?? 1, params.perPage ?? ARCHIVE_MAIL_PAGE_SIZE, {
      filter: buildDeletedOutgoingMailFilter(params),
      sort: params.sort ?? ARCHIVE_MAIL_SORT,
    });
}

/** Архивная запись удалённого входящего письма по идентификатору. */
export function getDeletedIncomingMail(id: string) {
  return pb.collection(DELETED_MAIL_INCOMING_COLLECTION).getOne<IDeletedIncomingMail>(id);
}

/** Архивная запись удалённого исходящего письма по идентификатору. */
export function getDeletedOutgoingMail(id: string) {
  return pb.collection(DELETED_MAIL_OUTGOING_COLLECTION).getOne<IDeletedOutgoingMail>(id);
}

/** Full deleted-incoming archive for client-side search across all pages. */
export function getAllDeletedIncomingMails(orgId: string): Promise<IDeletedIncomingMail[]> {
  return pb.collection(DELETED_MAIL_INCOMING_COLLECTION).getFullList<IDeletedIncomingMail>({
    filter: `organization_id = "${qTag(orgId)}"`,
    sort: ARCHIVE_MAIL_SORT,
  });
}

/** Full deleted-outgoing archive for client-side search across all pages. */
export function getAllDeletedOutgoingMails(orgId: string): Promise<IDeletedOutgoingMail[]> {
  return pb.collection(DELETED_MAIL_OUTGOING_COLLECTION).getFullList<IDeletedOutgoingMail>({
    filter: `organization_id = "${qTag(orgId)}"`,
    sort: ARCHIVE_MAIL_SORT,
  });
}
