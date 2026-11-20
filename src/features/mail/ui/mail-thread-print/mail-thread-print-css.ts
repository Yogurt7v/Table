/**
 * Печатный документ. Портал в `body` и класс `print-root` — по образцу
 * `PrintableInvoices`: правило `body > *:not(.print-root)` убирает со страницы
 * приложение целиком. Отличие одно: на экране корень скрыт, поэтому модалка с
 * флажками остаётся поверх и не превращается в предпросмотр в полстраницы.
 */
export const PRINT_CSS = `
  .print-root { display: none; }
  @media print {
    @page { margin: 10mm; }
    html, body { height: auto; overflow: visible; }
    body > *:not(.print-root) { display: none !important; }
    .print-root {
      display: block !important;
      color: #000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
    }
    .mail-print-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10mm; }
    .mail-print-heading {
      font-size: 11pt;
      font-weight: 700;
      margin: 0 0 4mm 0;
      padding-bottom: 1.5mm;
      border-bottom: 1px solid #000;
    }
    .mail-print-file { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8mm; }
    .mail-print-file-name { font-size: 9pt; margin: 0 0 2mm 0; }
    .mail-print-image { display: block; max-width: 100%; max-height: 225mm; object-fit: contain; margin: 0 auto; }
    .mail-print-frame { display: block; width: 100%; height: 235mm; border: 1px solid #999; }
    .mail-print-note {
      border: 1px dashed #666;
      padding: 4mm;
      font-size: 9pt;
      margin: 0;
    }
  }
`;
