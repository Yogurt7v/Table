/** Добавляет CSS-класс вспышки строке счёта и убирает его через 2.6 c. */
export function flashHighlightRow(invoiceId: string) {
  const el = document.querySelector(`[data-highlight-id="${CSS.escape(invoiceId)}"]`);
  if (!el || el.classList.contains('row-flash')) return;
  el.classList.add('row-flash');
  window.setTimeout(() => {
    el.classList.remove('row-flash');
  }, 2600);
}
