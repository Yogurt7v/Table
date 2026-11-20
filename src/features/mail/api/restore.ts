/** Восстановление писем из архива под исходными идентификаторами. */

import { pb } from '@/api/client';
import type {
  IDeletedIncomingMail,
  IDeletedOutgoingMail,
  IIncomingMail,
  IOutgoingMail,
} from '@/shared/types';
import { stripDeletionReason } from '@/shared/utils/deletion-reason';
import {
  DELETED_MAIL_HISTORY_COLLECTION,
  DELETED_MAIL_INCOMING_COLLECTION,
  DELETED_MAIL_OUTGOING_COLLECTION,
  MAIL_INCOMING_COLLECTION,
  MAIL_OUTGOING_COLLECTION,
} from './constants.ts';
import {
  createMailHistory,
  getDeletedIncomingMailHistory,
  getDeletedOutgoingMailHistory,
} from './history.ts';
import { currentActorId, currentActorName } from './shared.ts';

/**
 * Restores an archived incoming mail under its ORIGINAL id, then drops the
 * archive row together with its archive history and records a `restored` entry.
 *
 * Reusing `original_id` is mandatory here and has no invoice counterpart:
 * `mail_files.mail_id` is a plain text column, so a freshly generated id would
 * orphan every attachment. The invoice restore path can afford a new id only
 * because `deleted_invoice_files` snapshots the bytes and restoreDeletedInvoice
 * re-uploads them into the new invoice — mail has no file-archive collection and
 * deliberately needs none. Its `original_invoice_id`/`source_*` columns exist
 * only to preserve the copy chain, not the identity.
 *
 * `stripDeletionReason` снимает дописанную при удалении строку причины: письмо,
 * вернувшееся в реестр, не должно нести пометку об архивации.
 *
 * `created_by` клиент НЕ шлёт — ни `deleted.created_by`, ни `currentActorId()`.
 * Раньше здесь стояло `deleted.created_by || currentActorId()`, и `||` был не
 * стилистикой: миграция `1815000013_close_anonymous_create_hole` сделала поле
 * обязательным, а письмо, созданное анонимно ДО неё (при `createRule = ""` это
 * был штатный, а не вырожденный случай), лежит в архиве с `created_by: ''` —
 * пустой строкой, а не `null`, и `??` такую строку пропускает насквозь. Но весь
 * этот `||` был МЁРТВЫМ КОДОМ: хук `fillMailActorsOnCreateRequest` в
 * `pb_hooks/mail-notify.pb.js` перезаписывает `created_by` безусловно, поэтому
 * письмо всё равно показывало восстановителя автором, а фолбэк на
 * `currentActorId()` просто не выполнялся.
 *
 * Теперь клиент шлёт ссылку `restored_from_inmail_id`, и хук достаёт из архива
 * ПРЕЖНЕГО автора; фолбэк на восстановителя переехал в хук, где он и должен
 * быть. Доверять клиенту назначение автора нельзя — иначе любой пользователь
 * создал бы письмо от чужого имени.
 */
export async function restoreDeletedIncomingMail(deletedMailId: string): Promise<IIncomingMail> {
  const deleted = await pb
    .collection(DELETED_MAIL_INCOMING_COLLECTION)
    .getOne<IDeletedIncomingMail>(deletedMailId);

  const restored = await pb.collection(MAIL_INCOMING_COLLECTION).create<IIncomingMail>({
    id: deleted.original_id,
    organization_id: deleted.organization_id,
    date: deleted.date,
    subject: deleted.subject,
    sender: deleted.sender,
    responsible: deleted.responsible,
    accounting_object_id: deleted.accounting_object_id ?? '',
    seq: deleted.seq,
    number: deleted.number ?? '',
    sender_outgoing_number: deleted.sender_outgoing_number ?? '',
    responsible_name: deleted.responsible_name ?? '',
    delivery_method: deleted.delivery_method,
    comment: stripDeletionReason(deleted.comment),
    // Автора шлёт сервер, из архива — см. докблок функции.
    restored_from_inmail_id: deletedMailId,
    updated_by: currentActorId(),
    updated_by_name: currentActorName(),
  });

  const archiveHistory = await getDeletedIncomingMailHistory(deletedMailId);
  for (const entry of archiveHistory) {
    await createMailHistory({
      mailId: restored.id,
      mailType: 'incoming',
      organizationId: deleted.organization_id,
      previousData: entry.previous_data,
      type: entry.type,
    });
  }

  await createMailHistory({
    mailId: restored.id,
    mailType: 'incoming',
    organizationId: deleted.organization_id,
    previousData: {
      deleted_by: deleted.deleted_by,
      deleted_by_name: deleted.deleted_by_name,
      deleted_at: deleted.deleted_at,
    },
    type: 'restored',
  });

  await Promise.all(
    archiveHistory.map((entry) => pb.collection(DELETED_MAIL_HISTORY_COLLECTION).delete(entry.id)),
  );
  await pb.collection(DELETED_MAIL_INCOMING_COLLECTION).delete(deletedMailId);

  return restored;
}

/**
 * Outgoing twin of `restoreDeletedIncomingMail` — same original-id rule, same
 * reason: attachments reference the mail by plain text id.
 *
 * Причину, по которой `created_by` здесь не отправляется вовсе, см. в докблоке
 * входящего восстановления выше: автор резолвит серверный хук из архивной
 * копии, а клиентский `deleted.created_by || currentActorId()` был мёртвым
 * кодом, который хук всё равно перезаписывал.
 */
export async function restoreDeletedOutgoingMail(deletedMailId: string): Promise<IOutgoingMail> {
  const deleted = await pb
    .collection(DELETED_MAIL_OUTGOING_COLLECTION)
    .getOne<IDeletedOutgoingMail>(deletedMailId);

  const restored = await pb.collection(MAIL_OUTGOING_COLLECTION).create<IOutgoingMail>({
    id: deleted.original_id,
    organization_id: deleted.organization_id,
    date: deleted.date,
    subject: deleted.subject,
    recipient: deleted.recipient,
    responsible: deleted.responsible,
    outgoing_number: deleted.outgoing_number,
    accounting_object_id: deleted.accounting_object_id ?? '',
    seq: deleted.seq,
    counterparty_incoming_number: deleted.counterparty_incoming_number ?? '',
    responsible_name: deleted.responsible_name ?? '',
    delivery_method: deleted.delivery_method,
    comment: stripDeletionReason(deleted.comment),
    // Автора шлёт сервер, из архива — см. докблок функции.
    restored_from_outmail_id: deletedMailId,
    updated_by: currentActorId(),
    updated_by_name: currentActorName(),
  });

  const archiveHistory = await getDeletedOutgoingMailHistory(deletedMailId);
  for (const entry of archiveHistory) {
    await createMailHistory({
      mailId: restored.id,
      mailType: 'outgoing',
      organizationId: deleted.organization_id,
      previousData: entry.previous_data,
      type: entry.type,
    });
  }

  await createMailHistory({
    mailId: restored.id,
    mailType: 'outgoing',
    organizationId: deleted.organization_id,
    previousData: {
      deleted_by: deleted.deleted_by,
      deleted_by_name: deleted.deleted_by_name,
      deleted_at: deleted.deleted_at,
    },
    type: 'restored',
  });

  await Promise.all(
    archiveHistory.map((entry) => pb.collection(DELETED_MAIL_HISTORY_COLLECTION).delete(entry.id)),
  );
  await pb.collection(DELETED_MAIL_OUTGOING_COLLECTION).delete(deletedMailId);

  return restored;
}
