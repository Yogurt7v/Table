/** Счета: чтение, поиск, создание, копии, синхронизация остатков и обновления. */

import { pb } from '@/api/client';
import { normalizeInvoice } from '@/shared/utils/normalize-invoice';
import type { IInvoice } from '@/shared/types';
import { createInvoiceHistoryRecord, getInvoiceHistory } from './invoice-history.ts';
import { deleteInvoice } from './invoices-archive.ts';

/** Возвращает актуальные счета организации на указанную дату. */
export function getInvoices(orgId: string, date: string) {
  const today = date.slice(0, 10);

  return pb
    .collection('invoices')
    .getFullList<IInvoice>({
      filter: `organization_id = "${orgId}" && date <= "${today} 23:59:59" && (paid = false || paid_date >= "${today}")`,
      sort: '-created',
    })
    .then((list) => list.map(normalizeInvoice));
}

/** Возвращает счёт по идентификатору. */
export function getInvoice(invoiceId: string) {
  return pb.collection('invoices').getOne<IInvoice>(invoiceId).then(normalizeInvoice);
}

/** Возвращает количество счетов организации. */
export async function countInvoicesByOrg(orgId: string): Promise<number> {
  const result = await pb.collection('invoices').getList(1, 1, {
    filter: `organization_id = "${orgId}"`,
  });
  return result.totalItems;
}

/** Ищет уникальные названия контрагентов по подстроке в пределах организации. */
export function searchCounterparties(orgId: string, query: string) {
  if (!query.trim()) return Promise.resolve([]);
  const lowerQuery = query.toLowerCase();
  return pb
    .collection('invoices')
    .getFullList<IInvoice>({
      filter: `organization_id = "${orgId}"`,
      fields: 'counterparty',
      sort: '-created',
      requestKey: `search-counterparties-${orgId}-${query}`,
    })
    .then((list) => {
      const unique = new Map<string, string>();
      list.forEach((inv) => {
        if (inv.counterparty && inv.counterparty.toLowerCase().includes(lowerQuery)) {
          if (!unique.has(inv.counterparty)) {
            unique.set(inv.counterparty, inv.counterparty);
          }
        }
      });
      return Array.from(unique.values());
    });
}

/** Входные данные для создания счёта. */
export type CreateInvoiceInput = {
  organization_id: string;
  accounting_object_id: string;
  date: string;
  counterparty: string;
  purpose: string;
  contract_no?: string;
  invoice_no: string;
  amount: number;
  paid?: boolean;
  paid_date?: string;
  comment?: string;
  original_invoice_id?: string;
  source_paid_amount?: number;
  source_paid_date?: string;
  source_created?: string;
};

/** Создаёт счёт и нормализует числовые поля результата. */
export function createInvoice(data: CreateInvoiceInput) {
  return pb
    .collection('invoices')
    .create<IInvoice>({
      organization_id: data.organization_id,
      accounting_object_id: data.accounting_object_id,
      date: data.date.slice(0, 10),
      counterparty: data.counterparty,
      purpose: data.purpose,
      contract_no: data.contract_no ?? '',
      invoice_no: data.invoice_no,
      amount: data.amount,
      paid: data.paid ?? false,
      paid_date: data.paid_date ?? '',
      comment: data.comment ?? '',
      original_invoice_id: data.original_invoice_id ?? '',
      source_paid_amount: data.source_paid_amount ?? 0,
      source_paid_date: data.source_paid_date ?? '',
      source_created: data.source_created || undefined,
    })
    .then(normalizeInvoice);
}

/** Возвращает копии счёта, созданные из указанного оригинала. */
export function getInvoiceCopies(originalInvoiceId: string) {
  return pb
    .collection('invoices')
    .getFullList<IInvoice>({
      filter: `original_invoice_id = "${originalInvoiceId}"`,
      sort: 'created',
    })
    .then((list) => list.map(normalizeInvoice));
}

/** Рекурсивно удаляет счёт и всю цепочку его копий (через архивирование). */
async function deleteInvoiceTree(invoiceId: string) {
  const children = await getInvoiceCopies(invoiceId);
  for (const child of children) {
    await deleteInvoiceTree(child.id);
  }
  await deleteInvoice(invoiceId, 'заменено новой копией при синхронизации оплаты');
}

/**
 * Поднимается по цепочке original_invoice_id от счёта до верхнего оригинала
 * и возвращает его created (момент добавления корня). Если корня нет —
 * created самого счёта.
 */
export async function getRootOriginalCreated(invoice: IInvoice): Promise<string> {
  let current = invoice;
  const seen = new Set<string>([invoice.id]);
  while (current.original_invoice_id && !seen.has(current.original_invoice_id)) {
    seen.add(current.original_invoice_id);
    try {
      current = await getInvoice(current.original_invoice_id);
    } catch {
      break;
    }
  }
  return current.created || invoice.created || '';
}

/**
 * Синхронизирует копию счёта на остаток: удаляет старые копии (вместе с
 * вложенной цепочкой) и при положительном остатке создаёт новую со всеми
 * полями оригинала (дата — день оплаты payDate).
 */
export async function syncInvoiceCopy(
  source: IInvoice,
  amounts: number[],
  paid: boolean,
  payDate: string,
) {
  const copies = await getInvoiceCopies(source.id);
  await Promise.all(copies.map((c) => deleteInvoiceTree(c.id)));

  if (!paid) return null;

  const sourceCreated = await getRootOriginalCreated(source);
  const totalPaid = amounts.reduce((s, a) => s + (Number(a) || 0), 0);
  const remaining = (Number(source.amount) || 0) - totalPaid;
  if (remaining <= 0) return null;

  const remainderComment = source.comment?.trim()
    ? `Остаток. см историю.\n${source.comment}`
    : 'Остаток. см историю.';

  return createInvoice({
    organization_id: source.organization_id,
    accounting_object_id: source.accounting_object_id,
    date: payDate || source.date,
    counterparty: source.counterparty,
    purpose: source.purpose,
    contract_no: source.contract_no,
    invoice_no: source.invoice_no,
    amount: remaining,
    comment: remainderComment,
    original_invoice_id: source.id,
    source_paid_amount: totalPaid,
    source_paid_date: payDate || source.date,
    source_created: sourceCreated,
  }).then((copy) =>
    createInvoiceHistoryRecord(copy.id, {
      type: 'copy_created',
      previous_data: {
        amount: remaining,
        source_paid_amount: totalPaid,
        paid: false,
        original_invoice_id: source.id,
      },
    }).then(() => copy),
  );
}

/** Обновляет поля счёта и нормализует результат. */
export function updateInvoice(id: string, data: Partial<IInvoice>) {
  return pb.collection('invoices').update<IInvoice>(id, data).then(normalizeInvoice);
}

/** Обновляет счёт, предварительно записав предыдущее состояние в историю. */
export async function updateInvoiceWithHistory(
  id: string,
  data: Partial<IInvoice>,
  previousData: Record<string, unknown>,
) {
  // Записываем историю (type не задаём — обычное изменение счёта)
  await createInvoiceHistoryRecord(id, { previous_data: previousData });

  // Обновляем счёт
  return updateInvoice(id, data);
}

/**
 * Возвращает историю счёта вместе с историей всей цепочки «оригиналов»:
 * идёт от копии по original_invoice_id до исходного счёта и собирает
 * { invoice, history } для каждого звена. Сбой чтения отдельного звена
 * не обнуляет историю — недоступные звенья пропускаются.
 */
export async function getInvoiceHistoryChain(invoiceId: string) {
  const chain: IInvoice[] = [];
  let currentId: string | null = invoiceId;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    try {
      const inv = await getInvoice(currentId);
      chain.push(inv);
      currentId = inv.original_invoice_id ?? null;
    } catch {
      break;
    }
  }
  const results: { invoice: IInvoice; history: import('@/shared/types').IInvoiceHistory[] }[] = [];
  for (const invoice of chain) {
    try {
      const history = await getInvoiceHistory(invoice.id);
      results.push({ invoice, history });
    } catch {
      // пропускаем недоступное звено
    }
  }
  if (results.length === 0) {
    throw new Error('Не удалось загрузить историю счёта');
  }
  return results;
}

/** Возвращает все счета организации (укороченный набор полей) для поиска/экспорта. */
export function getAllInvoices(orgId: string) {
  return pb.collection('invoices').getFullList<IInvoice>({
    filter: `organization_id = "${orgId}"`,
    fields:
      'id,date,counterparty,purpose,amount,paid,paid_date,payment_amounts,contract_no,invoice_no,comment',
    sort: '-date',
  });
}

/** Ищет счета с тем же номером счёта в организации (проверка дублей). */
export function findDuplicateInvoices(orgId: string, invoiceNo: string) {
  return pb
    .collection('invoices')
    .getFullList<IInvoice>({
      filter: `organization_id = "${orgId}" && invoice_no = "${invoiceNo}"`,
      fields: 'id,invoice_no,counterparty,amount,date',
      sort: '-date',
    })
    .then((list) => list.map(normalizeInvoice));
}
