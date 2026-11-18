import type { IInvoice } from '@/shared/types';

/** Удаляет невидимые символы-разделители и схлопывает пробельные последовательности. */
export function stripInvisible(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\u00a0\u2000-\u200f\u2028-\u202f\u205f\u3000\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Вычисляет список id счетов, которые нужно подсветить поисковым текстом:
 * либо берёт переданные результаты поиска, либо фильтрует список инвойсов по полям.
 */
export function computeHighlightedIds(
  searchText: string,
  searchResults: IInvoice[] | undefined,
  invoices: IInvoice[] | undefined,
): string[] {
  if (!searchText) return [];
  if (searchResults) return searchResults.map((invoice) => invoice.id);
  if (!invoices) return [];

  const lower = stripInvisible(searchText).toLowerCase();
  return invoices
    .filter(
      (invoice) =>
        stripInvisible(invoice.counterparty).toLowerCase().includes(lower) ||
        stripInvisible(invoice.purpose).toLowerCase().includes(lower) ||
        invoice.contract_no.toLowerCase().includes(lower) ||
        invoice.invoice_no.toLowerCase().includes(lower) ||
        invoice.comment.toLowerCase().includes(lower) ||
        String(invoice.amount).includes(lower),
    )
    .map((invoice) => invoice.id);
}
