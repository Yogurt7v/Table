import type { IInvoice } from '@/shared/types';

export interface InvoiceGroup {
  counterparty: string;
  invoices: IInvoice[];
}

interface OrderKey {
  created: string;
  depth: number;
}

/**
 * Вычисляет ключ позиционирования счёта:
 * - обычный счёт — по `created` (момент добавления);
 * - копия (original_invoice_id), чей оригинал есть в выборке — по created
 *   корневого оригинала цепочки (глубина — tie-break, чтобы копии шли
 *   сразу после оригинала);
 * - копия без оригинала (сирота) — по source_created (запомненному месту
 *   корня) либо собственному created, если якорь не задан.
 */
function getOrderKey(
  invoice: IInvoice,
  idToInv: Map<string, IInvoice>,
  memo: Map<string, OrderKey>,
): OrderKey {
  const cached = memo.get(invoice.id);
  if (cached) return cached;

  let created = invoice.created || '';
  let depth = 0;

  if (invoice.original_invoice_id) {
    const parent = idToInv.get(invoice.original_invoice_id);
    if (parent) {
      const parentKey = getOrderKey(parent, idToInv, memo);
      created = parentKey.created;
      depth = parentKey.depth + 1;
    } else {
      created = invoice.source_created || created;
    }
  }

  const key: OrderKey = { created, depth };
  memo.set(invoice.id, key);
  return key;
}

function compareInvoices(
  a: IInvoice,
  b: IInvoice,
  idToInv: Map<string, IInvoice>,
  memo: Map<string, OrderKey>,
): number {
  const ka = getOrderKey(a, idToInv, memo);
  const kb = getOrderKey(b, idToInv, memo);
  if (ka.created !== kb.created) return ka.created < kb.created ? -1 : 1;
  if (ka.depth !== kb.depth) return ka.depth - kb.depth;
  const seqA = (a.seq ?? 0) || Infinity;
  const seqB = (b.seq ?? 0) || Infinity;
  if (seqA !== seqB) return seqA - seqB;
  return a.id.localeCompare(b.id);
}

/**
 * Группирует счета по контрагентам.
 * Внутри группы счета сортируются по моменту добавления (`created`),
 * копии частичной оплаты (original_invoice_id) ставятся сразу после своего
 * оригинала, сироты-копии — на место запомненного корня (source_created).
 *
 * Группы сортируются по минимальному ключу в группе (моменту первого
 * появления контрагента). Если передан `allInvoices` (полный список счетов,
 * включая скрытые), порядок групп вычисляется по нему — это сохраняет
 * стабильный порядок контрагентов даже при скрытии части счетов.
 *
 * Если передан `counterpartyOrder` (сохранённый пользователем порядок групп),
 * группы в этом списке идут в указанном порядке; контрагенты, которых в списке
 * нет (новые), добавляются в конец по моменту первого появления.
 */
export function groupInvoicesByCounterparty(
  invoices: IInvoice[],
  allInvoices?: IInvoice[],
  counterpartyOrder?: string[],
): InvoiceGroup[] {
  const grouped = new Map<string, IInvoice[]>();

  const idToInv = new Map<string, IInvoice>();
  invoices.forEach((inv) => {
    idToInv.set(inv.id, inv);
    if (!grouped.has(inv.counterparty)) {
      grouped.set(inv.counterparty, []);
    }
    grouped.get(inv.counterparty)!.push(inv);
  });

  const result: InvoiceGroup[] = [];
  const sortMemo = new Map<string, OrderKey>();
  grouped.forEach((invoices, counterparty) => {
    invoices.sort((a, b) => compareInvoices(a, b, idToInv, sortMemo));
    result.push({ counterparty, invoices });
  });

  const orderSource = allInvoices ?? invoices;
  const orderIdToInv = new Map<string, IInvoice>();
  orderSource.forEach((inv) => orderIdToInv.set(inv.id, inv));

  const orderMap = new Map<string, string>();
  const orderMemo = new Map<string, OrderKey>();
  orderSource.forEach((inv) => {
    const key = getOrderKey(inv, orderIdToInv, orderMemo);
    const current = orderMap.get(inv.counterparty);
    if (current === undefined || key.created < current) {
      orderMap.set(inv.counterparty, key.created);
    }
  });

  const groupIndex = new Map(result.map((g) => [g.counterparty, g]));
  const orderIndex = new Map(
    (counterpartyOrder ?? []).map((cp, i) => [cp, i] as const).filter(([cp]) => groupIndex.has(cp)),
  );

  const known: InvoiceGroup[] = [];
  const unknown: InvoiceGroup[] = [];
  result.forEach((group) => {
    (orderIndex.has(group.counterparty) ? known : unknown).push(group);
  });

  known.sort((a, b) => orderIndex.get(a.counterparty)! - orderIndex.get(b.counterparty)!);
  unknown.sort((a, b) => {
    const createdA = orderMap.get(a.counterparty) ?? '';
    const createdB = orderMap.get(b.counterparty) ?? '';
    if (createdA !== createdB) return createdA < createdB ? -1 : 1;
    return 0;
  });

  return [...known, ...unknown];
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