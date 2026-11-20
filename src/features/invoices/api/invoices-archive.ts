/** Архив счетов: удаление в архив, чтение архива, восстановление и работа с файлами архива. */

import { pb } from '@/api/client';
import { normalizeInvoice } from '@/shared/utils/normalize-invoice';
import { appendDeletionReason, stripDeletionReason } from '@/shared/utils/deletion-reason';
import { getLastKnownUser } from '@/shared/auth/last-known-user';
import type {
  IDeletedInvoice,
  IDeletedInvoiceFile,
  IDeletedInvoiceHistory,
  IInvoice,
  IInvoiceFile,
  IInvoiceHistory,
  InvoiceHistoryType,
} from '@/shared/types';
import { createInvoiceFile, getInvoiceFileUrl } from './invoice-files.ts';
import { createInvoiceHistoryRecord } from './invoice-history.ts';
import { getCurrentActorId, getCurrentAuthor } from '@/api/collections/shared';

/** Размер страницы архива удалённых счетов по умолчанию. */
export const ARCHIVE_PAGE_SIZE = 15;

/** Копирует историю счёта в архив удалённого счёта (best-effort). */
async function archiveDeletedInvoiceHistory(deletedInvoiceId: string, history: IInvoiceHistory[]) {
  for (const h of history) {
    try {
      await pb.collection('deleted_invoice_history').create<IDeletedInvoiceHistory>({
        deleted_invoice_id: deletedInvoiceId,
        author: h.author,
        changed_at: h.changed_at,
        previous_data: h.previous_data,
        type: h.type || '',
      });
    } catch {
      // history archival is best-effort
    }
  }
}

/** Копирует файлы счёта в архив удалённого счёта (best-effort, со скачиванием содержимого). */
async function archiveDeletedInvoiceFiles(invoiceId: string, files: IInvoiceFile[]) {
  for (const f of files) {
    const url = getInvoiceFileUrl(f);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const fileObj = new File([blob], f.name);
      const formData = new FormData();
      formData.append('deleted_invoice_id', invoiceId);
      formData.append('file', fileObj);
      formData.append('name', f.name);
      formData.append('original_file_id', f.id);
      await pb.collection('deleted_invoice_files').create<IDeletedInvoiceFile>(formData);
    } catch {
      // file archival is best-effort
    }
  }
}

/**
 * Архивирует счёт (история, файлы, запись архива с причиной удаления) и удаляет оригинал.
 * `reason` обязателен и дописывается последней строкой в comment архивной записи.
 */
export async function deleteInvoice(id: string, reason: string) {
  const invoice = await pb.collection('invoices').getOne<IInvoice>(id);

  const historyRecords = await pb.collection('invoice_history').getFullList<IInvoiceHistory>({
    filter: `invoice_id = "${id}"`,
  });

  const files = await pb.collection('invoice_files').getFullList<IInvoiceFile>({
    filter: `invoice_id = "${id}" && is_deleted != true`,
  });

  // Create archive record first — we need its ID for history/files
  const deletedInvoice = await pb.collection('deleted_invoices').create<IDeletedInvoice>({
    original_id: invoice.id,
    organization_id: invoice.organization_id,
    accounting_object_id: invoice.accounting_object_id,
    date: invoice.date,
    seq: invoice.seq,
    counterparty: invoice.counterparty,
    purpose: invoice.purpose,
    contract_no: invoice.contract_no,
    invoice_no: invoice.invoice_no,
    amount: invoice.amount,
    paid: invoice.paid,
    paid_date: invoice.paid_date,
    paid_amount: invoice.paid_amount,
    payment_amounts: invoice.payment_amounts,
    comment: appendDeletionReason(invoice.comment, reason),
    copy_comments: invoice.copy_comments,
    created_by: invoice.created_by,
    updated_by: invoice.updated_by,
    created_by_name: invoice.created_by_name || '',
    updated_by_name: invoice.updated_by_name || '',
    original_invoice_id: invoice.original_invoice_id || '',
    source_paid_amount: invoice.source_paid_amount,
    source_paid_date: invoice.source_paid_date,
    source_created: invoice.source_created,
    deleted_by: getCurrentActorId(),
    deleted_by_name:
      pb.authStore.model?.name ||
      pb.authStore.model?.email ||
      getLastKnownUser()?.name ||
      getLastKnownUser()?.email ||
      '',
    deleted_at: new Date().toISOString(),
  });

  await archiveDeletedInvoiceHistory(deletedInvoice.id, historyRecords);
  await archiveDeletedInvoiceFiles(deletedInvoice.id, files);

  await pb.collection('deleted_invoice_history').create<IDeletedInvoiceHistory>({
    deleted_invoice_id: deletedInvoice.id,
    author: getCurrentAuthor(),
    changed_at: new Date().toISOString(),
    previous_data: {
      deleted_by: deletedInvoice.deleted_by,
      deleted_by_name: deletedInvoice.deleted_by_name,
      deleted_at: deletedInvoice.deleted_at,
    },
    type: 'invoice_deleted',
  });

  await Promise.all(
    historyRecords.map((record) => pb.collection('invoice_history').delete(record.id)),
  );
  return pb.collection('invoices').delete(id);
}

/** Возвращает страницу архива удалённых счетов организации. */
export function getDeletedInvoices(orgId: string, page: number, perPage: number) {
  return pb.collection('deleted_invoices').getList<IDeletedInvoice>(page, perPage, {
    filter: `organization_id = "${orgId}"`,
    sort: '-deleted_at',
    expand: 'accounting_object_id',
  });
}

/** Возвращает архивную запись удалённого счёта по её идентификатору. */
export function getDeletedInvoiceById(id: string) {
  return pb.collection('deleted_invoices').getOne<IDeletedInvoice>(id, {
    expand: 'accounting_object_id',
  });
}

/** Находит архивную запись удалённого счёта по идентификатору оригинального счёта. */
export function getDeletedInvoiceByOriginalId(orgId: string, invoiceId: string) {
  return pb
    .collection('deleted_invoices')
    .getFirstListItem<IDeletedInvoice>(
      `organization_id = "${orgId}" && original_id = "${invoiceId}"`,
      { expand: 'accounting_object_id' },
    );
}

/** Возвращает весь архив удалённых счетов организации. */
export function getAllDeletedInvoices(orgId: string) {
  return pb.collection('deleted_invoices').getFullList<IDeletedInvoice>({
    filter: `organization_id = "${orgId}"`,
    sort: '-deleted_at',
    expand: 'accounting_object_id',
  });
}

/** Возвращает историю удалённого счёта из архива. */
export function getDeletedInvoiceHistory(deletedInvoiceId: string) {
  return pb.collection('deleted_invoice_history').getFullList<IDeletedInvoiceHistory>({
    filter: `deleted_invoice_id = "${deletedInvoiceId}"`,
    sort: 'changed_at',
  });
}

/** Возвращает файлы удалённого счёта из архива. */
export function getDeletedInvoiceFiles(deletedInvoiceId: string) {
  return pb.collection('deleted_invoice_files').getFullList<IDeletedInvoiceFile>({
    filter: `deleted_invoice_id = "${deletedInvoiceId}"`,
  });
}

/** Возвращает URL архивного файла удалённого счёта. */
export function getDeletedInvoiceFileUrl(record: IDeletedInvoiceFile) {
  return pb.files.getURL(record, record.file);
}

/**
 * Восстанавливает счёт из архива: создаёт новый счёт, переносит историю и файлы,
 * записывает событие восстановления и удаляет архивные записи.
 */
export async function restoreDeletedInvoice(deletedInvoiceId: string): Promise<IInvoice> {
  const deleted = await pb.collection('deleted_invoices').getOne<IDeletedInvoice>(deletedInvoiceId);

  // 1. Create new invoice (seq will be auto-numbered)
  //
  // Автора счёта НЕ шлём: серверный хук `onRecordCreateRequest(..., 'invoices')`
  // в `pb_hooks/notify.pb.js` и так перезаписывает `created_by` на того, кто
  // создаёт, — клиентское значение всё равно проигнорировалось бы. Вместо этого
  // шлём ссылку на архивную запись: хук достаёт из неё ИСХОДНОГО автора, и
  // возвращённый из архива счёт показывает в «Инициаторе» того, кто его завёл,
  // а не того, кто его восстановил.
  //
  // Ссылка, а не готовый `created_by`, — принципиально: доверять клиенту в
  // назначении автора нельзя, иначе любой пользователь создал бы счёт от чужого
  // имени. Хук сам берёт автора из архива, а если там пусто (счёт, созданный
  // анонимно) — откатывается на автора восстановителя.
  const newInvoice = await pb
    .collection('invoices')
    .create<IInvoice>({
      organization_id: deleted.organization_id,
      accounting_object_id: deleted.accounting_object_id,
      date: deleted.date,
      counterparty: deleted.counterparty,
      purpose: deleted.purpose,
      contract_no: deleted.contract_no,
      invoice_no: deleted.invoice_no,
      amount: deleted.amount,
      paid: deleted.paid,
      paid_date: deleted.paid_date,
      comment: stripDeletionReason(deleted.comment),
      original_invoice_id: deleted.original_invoice_id || '',
      source_paid_amount: deleted.source_paid_amount,
      source_paid_date: deleted.source_paid_date,
      source_created: deleted.source_created || undefined,
      restored_from_invoice_id: deletedInvoiceId,
    })
    .then(normalizeInvoice);

  // 2. Restore history
  const history = await pb
    .collection('deleted_invoice_history')
    .getFullList<IDeletedInvoiceHistory>({
      filter: `deleted_invoice_id = "${deletedInvoiceId}"`,
    });
  for (const h of history) {
    await pb.collection('invoice_history').create<IInvoiceHistory>({
      invoice_id: newInvoice.id,
      author: h.author,
      changed_at: h.changed_at,
      previous_data: h.previous_data,
      type: h.type as InvoiceHistoryType,
    });
  }

  // Record the restore event in the new invoice's history
  await createInvoiceHistoryRecord(newInvoice.id, {
    type: 'invoice_restored',
    previous_data: {
      deleted_by: deleted.deleted_by,
      deleted_by_name: deleted.deleted_by_name,
      deleted_at: deleted.deleted_at,
    },
  });

  // 3. Restore files
  const deletedFiles = await pb
    .collection('deleted_invoice_files')
    .getFullList<IDeletedInvoiceFile>({
      filter: `deleted_invoice_id = "${deletedInvoiceId}"`,
    });
  for (const df of deletedFiles) {
    try {
      const url = getDeletedInvoiceFileUrl(df);
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], df.name);
      await createInvoiceFile(newInvoice.id, deleted.organization_id, file, df.name);
    } catch {
      // file restore is best-effort
    }
  }

  // 4. Delete from archive
  await pb.collection('deleted_invoice_history').unsubscribe('*');
  const archiveHistory = await pb
    .collection('deleted_invoice_history')
    .getFullList({ filter: `deleted_invoice_id = "${deletedInvoiceId}"` });
  await Promise.all(
    archiveHistory.map((r) => pb.collection('deleted_invoice_history').delete(r.id)),
  );
  const archiveFiles = await pb
    .collection('deleted_invoice_files')
    .getFullList({ filter: `deleted_invoice_id = "${deletedInvoiceId}"` });
  await Promise.all(archiveFiles.map((r) => pb.collection('deleted_invoice_files').delete(r.id)));
  await pb.collection('deleted_invoices').delete(deletedInvoiceId);

  return newInvoice;
}
