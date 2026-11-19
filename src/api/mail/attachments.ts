/** Вложения писем: чтение, загрузка, удаление и построение URL. */

import { pb } from '../client.ts';
import type { IMailFile, MailType } from '@/shared/types';
import { MAIL_FILES_COLLECTION } from './constants.ts';
import { currentActorId, currentActorName, qTag } from './shared.ts';

/** Attachments of one mail, in upload order. Keyed by the polymorphic mail_id. */
export function getMailFiles(mailId: string, mailType: MailType) {
  return pb.collection(MAIL_FILES_COLLECTION).getFullList<IMailFile>({
    filter: `mail_id = "${qTag(mailId)}" && mail_type = "${mailType}"`,
    sort: 'created',
  });
}

/**
 * URL вложения. `pb.files.getURL` ждёт одно имя файла, а `mail_files.file` —
 * multiple-поле, поэтому берём первый элемент: `uploadMailFiles` создаёт по
 * одной записи на файл. `getURL` сам возвращает `''` на неполной записи, что
 * в `<Anchor href>` даёт битую ссылку, поэтому пустое приводим к `null`.
 */
export function getMailFileUrl(fileRecord: IMailFile): string | null {
  const filename = fileRecord.file?.[0];
  if (!filename) return null;
  return pb.files.getURL(fileRecord, filename) || null;
}

/**
 * Uploads attachments as one `mail_files` record per file. `name` is a single
 * text column while `file` allows up to 10 files, so batching several files
 * into one record has nowhere to put per-file names; the FormData field names
 * match createInvoiceFile's convention exactly.
 */
export async function uploadMailFiles(
  mailId: string,
  mailType: MailType,
  organizationId: string,
  files: File[],
) {
  const actorId = currentActorId();
  const actorName = currentActorName();
  return Promise.all(
    files.map((file) => {
      const formData = new FormData();
      formData.append('mail_id', mailId);
      formData.append('mail_type', mailType);
      formData.append('organization_id', organizationId);
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('created_by', actorId);
      formData.append('created_by_name', actorName);
      return pb.collection(MAIL_FILES_COLLECTION).create<IMailFile>(formData);
    }),
  );
}

/** Удаляет запись вложения письма. */
export function deleteMailFile(id: string) {
  return pb.collection(MAIL_FILES_COLLECTION).delete(id);
}
