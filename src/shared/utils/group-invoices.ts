import type { IInvoice } from '@/shared/types';

export interface InvoiceGroup {
  counterparty: string;
  invoices: IInvoice[];
}

/**
 * Группирует счета по контрагентам.
 * Внутри группы счета сортируются по дате создания (новые вверху).
 * Группы сортируются по дате первого счета группы.
 */
export function groupInvoicesByCounterparty(invoices: IInvoice[]): InvoiceGroup[] {
  const grouped = new Map<string, IInvoice[]>();

  invoices.forEach((inv) => {
    if (!grouped.has(inv.counterparty)) {
      grouped.set(inv.counterparty, []);
    }
    grouped.get(inv.counterparty)!.push(inv);
  });

  // Сортируем каждую группу по дате создания (новые вверху)
  const result: InvoiceGroup[] = [];
  grouped.forEach((invoices, counterparty) => {
    invoices.sort((a, b) => {
      const dateA = new Date(a.created ?? 0).getTime();
      const dateB = new Date(b.created ?? 0).getTime();
      return dateB - dateA; // Новые вверху
    });
    result.push({ counterparty, invoices });
  });

  // Сортируем группы по дате первого счета (новые группы вверху)
  result.sort((a, b) => {
    const dateA = new Date(a.invoices[0]?.created ?? 0).getTime();
    const dateB = new Date(b.invoices[0]?.created ?? 0).getTime();
    return dateB - dateA;
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
