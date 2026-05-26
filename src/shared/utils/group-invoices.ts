import type { IInvoice } from '@/shared/types';

export interface InvoiceGroup {
  counterparty: string;
  invoices: IInvoice[];
}

/**
 * Группирует счета по контрагентам.
 * Внутри группы счета сортируются по seq.
 * Группы сортируются по минимальному seq в группе.
 */
export function groupInvoicesByCounterparty(invoices: IInvoice[]): InvoiceGroup[] {
  const grouped = new Map<string, IInvoice[]>();

  invoices.forEach((inv) => {
    if (!grouped.has(inv.counterparty)) {
      grouped.set(inv.counterparty, []);
    }
    grouped.get(inv.counterparty)!.push(inv);
  });

  const result: InvoiceGroup[] = [];
  grouped.forEach((invoices, counterparty) => {
    invoices.sort((a, b) => {
      const seqA = (a.seq ?? 0) || Infinity;
      const seqB = (b.seq ?? 0) || Infinity;
      return seqA - seqB;
    });
    result.push({ counterparty, invoices });
  });

  result.sort((a, b) => {
    const seqA = Math.min(...a.invoices.map((inv) => inv.seq ?? 0)) || Infinity;
    const seqB = Math.min(...b.invoices.map((inv) => inv.seq ?? 0)) || Infinity;
    return seqA - seqB;
  });

  return result;
}

/**
 * Вычисляет порядковый номер для счета в пределах всех счетов.
 */
export function getInvoiceNumber(groups: InvoiceGroup[], targetInvoiceId: string): number {
  let number = 0;
  for (const group of groups) {
    for (const inv of group.invoices) {
      number++;
      if (inv.id === targetInvoiceId) return number;
    }
  }
  return 0;
}
