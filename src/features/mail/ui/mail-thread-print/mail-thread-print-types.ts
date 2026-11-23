import type { ThreadLineNode } from '@/features/mail/model/mail-thread-builder';
import type { MailPrintFile, MailPrintLetter } from '@/features/mail/model/mail-thread-print';

/** Пропсы модалки печати вложений переписки. */
export interface MailThreadPrintModalProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  /** Линия писем из конструктора: тот же порядок и те же глубины. */
  nodes: readonly ThreadLineNode[];
  /** Широкий экран: модалка встаёт рядом с конструктором, узкий — во весь экран. */
  wide: boolean;
}

/** Письмо и то, что отмечено под ним к печати. */
export interface PrintRow {
  readonly letter: MailPrintLetter;
  readonly files: readonly MailPrintFile[];
}

/** Состояние одного файла: блоб получен или не получен. */
export type PrintBlobStatus = 'loading' | 'ready' | 'failed';

/** Запись о файле, для которого блоб нужно получить. */
export interface PrintBlobEntry {
  readonly id: string;
  readonly url: string;
}

/** Что удалось получить по файлу: готовый объектный URL или ничего. */
export interface PrintBlobs {
  readonly statuses: ReadonlyMap<string, Exclude<PrintBlobStatus, 'loading'>>;
  readonly urlFor: (id: string) => string | null;
}
