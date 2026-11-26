/** Находит видимый элемент подсветки: mobile и desktop рендерят один id, нужен видимый. */
export function findVisibleHighlightEl(invoiceId: string): Element | null {
  const sel = `[data-highlight-id="${CSS.escape(invoiceId)}"]`;
  for (const el of document.querySelectorAll(sel)) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

/** Добавляет CSS-класс вспышки строке счёта и убирает его через 2.6 c. */
export function flashHighlightRow(invoiceId: string) {
  const el = findVisibleHighlightEl(invoiceId);
  if (!el || el.classList.contains('row-flash')) return;
  el.classList.add('row-flash');
  window.setTimeout(() => {
    el.classList.remove('row-flash');
  }, 2600);
}
