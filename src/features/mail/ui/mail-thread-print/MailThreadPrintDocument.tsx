import { createPortal } from 'react-dom';
import type { MailPrintFile } from '@/features/mail/model/mail-thread-print';
import { PRINT_CSS } from './mail-thread-print-css';
import { printFileNote } from './mail-thread-print-note';
import type { PrintBlobs, PrintRow } from './mail-thread-print-types';

/**
 * Печатный документ. Портал в `body` и класс `print-root` — по образцу
 * `PrintableInvoices`: правило `body > *:not(.print-root)` убирает со страницы
 * приложение целиком. Отличие одно: на экране корень скрыт, поэтому модалка с
 * флажками остаётся поверх и не превращается в предпросмотр в полстраницы.
 */
export function MailThreadPrintDocument({
  rows,
  blobs,
}: {
  rows: readonly PrintRow[];
  blobs: PrintBlobs;
}) {
  return createPortal(
    <div className="print-root">
      <style>{PRINT_CSS}</style>
      {rows.map((row) => (
        <section key={row.letter.key} className="mail-print-block">
          {/* Заголовок письма */}
          <h2 className="mail-print-heading">{row.letter.heading}</h2>
          {row.files.map((file) => (
            <PrintableFile key={file.id} file={file} blobs={blobs} />
          ))}
        </section>
      ))}
    </div>,
    document.body,
  );
}

/**
 * Один файл на печати. Картинка рисуется `<img>`, PDF — рамкой с его же
 * содержимым, всё остальное — рамкой с названием: показать содержимое документа
 * или таблицы без библиотеки нельзя, и делать вид, что можно, нечестно.
 */
export function PrintableFile({ file, blobs }: { file: MailPrintFile; blobs: PrintBlobs }) {
  const status = blobs.statuses.get(file.id) ?? 'loading';
  const url = blobs.urlFor(file.id);
  const note = printFileNote(file.kind, status);

  return (
    <div className="mail-print-file">
      {/* Название файла */}
      <p className="mail-print-file-name">{file.displayName}</p>
      {/* Содержимое файла либо честная пометка вместо него */}
      {note !== null ? (
        <p className="mail-print-note">{note}</p>
      ) : file.kind === 'image' ? (
        <img className="mail-print-image" src={url ?? ''} alt={file.displayName} />
      ) : (
        <iframe className="mail-print-frame" title={file.displayName} src={url ?? ''} />
      )}
    </div>
  );
}
