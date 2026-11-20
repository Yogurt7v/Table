import { pb } from '@/api/client';
import { MAIL_FILES_COLLECTION } from '@/api/mail';
import { formatMailDate } from './mail-date';
import { MAIL_EMPTY_CELL, MAIL_REGISTER_BADGE_LABELS } from './mail-labels';
import { mailNodeKey } from './mail-thread';
import type { MailNodeKey } from './mail-thread';
import type { ThreadLineNode } from './mail-thread-builder';
import type { IMailFile, MailType } from '@/shared/types';

/**
 * Печать вложений переписки: превращение линии писем и записей `mail_files` в
 * строки, которые можно показать и напечатать. Модуль чистый — ни React, ни
 * сети, — поэтому вся печать проверяется тестом без рендера.
 *
 * Три вещи, которые легко испортить, и почему они сделаны именно так:
 *
 *  1. **Единица печати — физический файл, а не запись.** `mail_files.file` —
 *     multiple до десяти файлов, и `name` у записи один на всех. Загрузчик
 *     (`uploadMailFiles`) делает по записи на файл, поэтому в норме в записи
 *     ровно один файл, но правильность печати не должна зависеть от того, мимо
 *     загрузчика завели запись или нет: каждый элемент `file[]` получает свой
 *     адрес `запись#позиция`, своё имя и свой флажок.
 *  2. **Линия писем не обходится заново.** Порядок и глубина приходят готовыми
 *     (`ThreadLineNode[]` из `buildThreadLine`), поэтому напечатанное дерево
 *     совпадает с тем, что показано в конструкторе, — включая письмо, снятое с
 *     переписки последним сбросом.
 *  3. **Тип файла честно ограничен.** На печать выводятся только то, что браузер
 *     умеет показать сам: картинки и PDF. Всё остальное получает блок с названием
 *     и письмом, к которому файл приложен, — выдумывать содержимое нельзя.
 */

/** Что браузер действительно напечатает содержимым, а не только названием. */
export type MailPrintFileKind = 'image' | 'pdf' | 'other';

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
  'ico',
  'tif',
  'tiff',
]);

/** Письмо, которого в графе уже нет: подписи у него нет вовсе. */
const MISSING_LETTER_HEADING = 'Письмо недоступно — связь ссылается на удалённое письмо';

/** Один физический файл вложения — то, у чего есть свой флажок и своя страница. */
export interface MailPrintFile {
  /** Адрес файла внутри печати: `запись#позиция`. Уникален в пределах цепочки. */
  readonly id: string;
  /** Прямая ссылка именно на этот файл, а не на первый в записи. */
  readonly url: string;
  /** Имя, под которым файл лежит в хранилище: расширение у него сохранено. */
  readonly storedName: string;
  /** Имя для показа: исходное, а в пакетной записи — вместе с именем из хранилища. */
  readonly displayName: string;
  readonly kind: MailPrintFileKind;
}

/** Письмо линии со своими вложениями: строка дерева плюс то, что под ней печатается. */
export interface MailPrintLetter {
  readonly key: MailNodeKey;
  readonly type: MailType;
  readonly id: string;
  /** Шаг от начала цепочки — тот же отступ, что у строки в конструкторе. */
  readonly depth: number;
  readonly index: number;
  /** Подпись письма для заголовка печатного документа. */
  readonly heading: string;
  readonly files: readonly MailPrintFile[];
}

/** Расширение после последней точки, в нижнем регистре. Имени без точки — пусто. */
function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/**
 * Тип файла для печати. Расширение берётся из имени в хранилище: PocketBase
 * переименовывает файл, но расширение оставляет, — а исходное `name` записи
 * используется запасным, на случай если запись заводят мимо загрузчика.
 */
export function mailPrintFileKind(storedName: string, originalName?: string): MailPrintFileKind {
  const extension = fileExtension(storedName) || fileExtension(originalName ?? '');
  if (extension === 'pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  return 'other';
}

/**
 * Ссылка на конкретный файл записи. `getMailFileUrl` из `src/api/mail.ts` берёт
 * всегда `file[0]`, а печатать надо выбранный файл, поэтому ссылка собирается
 * здесь — тем же `pb.files.getURL`, но с именем файла, а не записи. Коллекция
 * передаётся именем: `collectionId` в выборке `useOrgMailFiles` не запрашивается.
 */
export function mailPrintFileUrl(record: IMailFile, storedName: string): string {
  return pb.files.getURL({ id: record.id, collectionName: MAIL_FILES_COLLECTION }, storedName);
}

/**
 * Имя файла для показа. У записи `name` один, а файлов — до десяти, поэтому в
 * пакетной записи к исходному имени добавляется имя из хранилища: иначе десять
 * строк «Договор.pdf» не отличить друг от друга.
 */
function printFileDisplayName(originalName: string, storedName: string, batchSize: number): string {
  const original = originalName.trim();
  if (batchSize <= 1) return original || storedName;
  return original && original !== storedName ? `${original} · ${storedName}` : storedName;
}

/** Подпись письма для печатного документа: регистр, дата, номер, контрагент. */
export function printLetterHeading(node: ThreadLineNode): string {
  const letter = node.letter;
  if (!letter) return `${MAIL_REGISTER_BADGE_LABELS[node.type]} · ${MISSING_LETTER_HEADING}`;
  return [
    MAIL_REGISTER_BADGE_LABELS[node.type],
    formatMailDate(letter.date) || MAIL_EMPTY_CELL,
    `№ ${letter.number || MAIL_EMPTY_CELL}`,
    letter.counterparty || MAIL_EMPTY_CELL,
  ].join(' · ');
}

/**
 * Записи вложений по письмам цепочки. Ключ — `регистр:id`, как в графе
 * переписки, потому что `mail_id` в `mail_files` текстовый и сам по себе
 * регистра не различает.
 */
export function groupPrintFilesByLetter(
  records: readonly IMailFile[],
): ReadonlyMap<MailNodeKey, IMailFile[]> {
  const grouped = new Map<MailNodeKey, IMailFile[]>();
  for (const record of records) {
    const key = mailNodeKey(record.mail_type, record.mail_id);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(record);
    } else {
      grouped.set(key, [record]);
    }
  }
  return grouped;
}

/**
 * Линия писем плюс вложения: та же строка, тот же порядок, те же глубины.
 * Письмо без вложений остаётся в дереве — иначе напечатанное отличалось бы от
 * показанного, а исчезновение письма без файлов ничем не объяснилось бы.
 */
export function buildThreadPrintLetters(
  nodes: readonly ThreadLineNode[],
  files: ReadonlyMap<MailNodeKey, readonly IMailFile[]>,
): MailPrintLetter[] {
  const letters: MailPrintLetter[] = [];

  for (const node of nodes) {
    const items: MailPrintFile[] = [];

    for (const record of files.get(node.key) ?? []) {
      // Запись без файла (оборванная загрузка) не печатает ничего: пустой флажок
      // без содержимого выглядел бы как ошибка печати.
      const stored = (record.file ?? []).filter((storedName) => !!storedName);
      let position = 0;
      for (const storedName of stored) {
        items.push({
          id: `${record.id}#${position}`,
          url: mailPrintFileUrl(record, storedName),
          storedName,
          displayName: printFileDisplayName(record.name ?? '', storedName, stored.length),
          kind: mailPrintFileKind(storedName, record.name),
        });
        position += 1;
      }
    }

    letters.push({
      key: node.key,
      type: node.type,
      id: node.id,
      depth: node.depth,
      index: node.index,
      heading: printLetterHeading(node),
      files: items,
    });
  }

  return letters;
}

/** Сколько физических файлов во всей цепочке: столько покажет кнопка печати. */
export function countPrintFiles(letters: readonly MailPrintLetter[]): number {
  let total = 0;
  for (const letter of letters) total += letter.files.length;
  return total;
}

/** Счётчик выбора: сколько отмечено из скольких, обоими числами сразу. */
export function printSelectionLabel(selected: number, total: number): string {
  return `Выбрано ${selected} из ${total}`;
}
