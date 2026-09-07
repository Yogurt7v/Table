import type { IInvoice } from '@/shared/types';

export interface InvoiceGroup {
  counterparty: string;
  invoices: IInvoice[];
}

/**
 * Группирует счета по контрагентам.
 * Внутри группы счета сортируются по seq.
 * Группы сортируются по минимальному seq в группе.
 *
 * Если передан `allInvoices` (полный список счетов, включая скрытые),
 * порядок групп вычисляется по нему — это сохраняет стабильный порядок
 * контрагентов даже при скрытии оплаченных счетов.
 */
export function groupInvoicesByCounterparty(
  invoices: IInvoice[],
  allInvoices?: IInvoice[],
): InvoiceGroup[] {
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

  const orderSource = allInvoices ?? invoices;
  const orderMap = new Map<string, number>();
  orderSource.forEach((inv) => {
    const seq = (inv.seq ?? 0) || Infinity;
    const current = orderMap.get(inv.counterparty) ?? Infinity;
    if (seq < current) {
      orderMap.set(inv.counterparty, seq);
    }
  });

  result.sort((a, b) => {
    const seqA = orderMap.get(a.counterparty) ?? Infinity;
    const seqB = orderMap.get(b.counterparty) ?? Infinity;
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
