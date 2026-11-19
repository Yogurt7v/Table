/** История действий с письмами: запись и чтение записей mail_history. */

import { pb } from '../client.ts';
import type { IDeletedMailHistory, IMailHistory, MailHistoryType, MailType } from '@/shared/types';
import { DELETED_MAIL_HISTORY_COLLECTION, MAIL_HISTORY_COLLECTION } from './constants.ts';
import { currentActorId, currentActorName, qTag } from './shared.ts';

/** Параметры создания записи истории письма. */
export type CreateMailHistoryParams = {
  mailId: string;
  mailType: MailType;
  organizationId: string;
  previousData: Record<string, unknown>;
  type: MailHistoryType;
};

/**
 * Appends one `mail_history` row for either register. `author` is the user id
 * (not a relation — the display name is snapshotted into `author_name`), and
 * only the relation field matching `mailType` is set.
 */
export function createMailHistory(params: CreateMailHistoryParams) {
  return pb.collection(MAIL_HISTORY_COLLECTION).create<IMailHistory>({
    incoming_mail_id: params.mailType === 'incoming' ? params.mailId : '',
    outgoing_mail_id: params.mailType === 'outgoing' ? params.mailId : '',
    organization_id: params.organizationId,
    author: currentActorId(),
    author_name: currentActorName(),
    changed_at: new Date().toISOString(),
    type: params.type,
    previous_data: params.previousData,
  });
}

/** История входящего письма, от новых записей к старым. */
export function getIncomingMailHistory(mailId: string) {
  return pb.collection(MAIL_HISTORY_COLLECTION).getFullList<IMailHistory>({
    filter: `incoming_mail_id = "${qTag(mailId)}"`,
    sort: '-changed_at',
  });
}

/** История исходящего письма, от новых записей к старым. */
export function getOutgoingMailHistory(mailId: string) {
  return pb.collection(MAIL_HISTORY_COLLECTION).getFullList<IMailHistory>({
    filter: `outgoing_mail_id = "${qTag(mailId)}"`,
    sort: '-changed_at',
  });
}

/** История удалённого входящего письма (архив). */
export function getDeletedIncomingMailHistory(deletedMailId: string) {
  return pb.collection(DELETED_MAIL_HISTORY_COLLECTION).getFullList<IDeletedMailHistory>({
    filter: `deleted_incoming_mail_id = "${qTag(deletedMailId)}"`,
    sort: '-changed_at',
  });
}

/** История удалённого исходящего письма (архив). */
export function getDeletedOutgoingMailHistory(deletedMailId: string) {
  return pb.collection(DELETED_MAIL_HISTORY_COLLECTION).getFullList<IDeletedMailHistory>({
    filter: `deleted_outgoing_mail_id = "${qTag(deletedMailId)}"`,
    sort: '-changed_at',
  });
}
