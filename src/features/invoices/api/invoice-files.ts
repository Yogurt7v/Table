/** Файлы, прикреплённые к счетам: чтение, загрузка, мягкое удаление и URL. */

import { pb } from '@/api/client';
import type { IInvoiceFile } from '@/shared/types';

/** Возвращает все неудалённые файлы счетов организации. */
export function getInvoiceFilesByOrg(orgId: string) {
  return pb.collection('invoice_files').getFullList<IInvoiceFile>({
    filter: `organization_id = "${orgId}" && is_deleted != true`,
    sort: 'created',
  });
}

/** Возвращает неудалённые файлы конкретного счёта. */
export function getInvoiceFiles(invoiceId: string) {
  return pb.collection('invoice_files').getFullList<IInvoiceFile>({
    filter: `invoice_id = "${invoiceId}" && is_deleted != true`,
    sort: 'created',
  });
}

/** Загружает файл и создаёт запись в коллекции файлов счёта. */
export function createInvoiceFile(invoiceId: string, orgId: string, file: File, name: string) {
  const formData = new FormData();
  formData.append('invoice_id', invoiceId);
  formData.append('organization_id', orgId);
  formData.append('file', file);
  formData.append('name', name);
  return pb.collection('invoice_files').create<IInvoiceFile>(formData);
}

/** Помечает файл счёта как удалённый (мягкое удаление). */
export function softDeleteInvoiceFile(id: string) {
  return pb.collection('invoice_files').update<IInvoiceFile>(id, {
    is_deleted: true,
    deleted_at: new Date().toISOString(),
  });
}

/** Возвращает URL файла счёта по записи коллекции. */
export function getInvoiceFileUrl(fileRecord: IInvoiceFile) {
  return pb.files.getURL(fileRecord, fileRecord.file);
}

/** Возвращает URL для скачивания файла счёта по идентификаторам файла. */
export function getInvoiceFileDownloadUrl(data: { file_id: string; file: string }) {
  return pb.files.getURL({ id: data.file_id, collectionName: 'invoice_files' }, data.file);
}
