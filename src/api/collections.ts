import { pb } from './client.ts';
import { normalizeInvoice } from '@/shared/utils/normalize-invoice';
import type {
  IOrganization,
  IBankAccount,
  IBalanceHistory,
  IAccountWithBalance,
  IAccountingObject,
  IInvoice,
  IInvoiceFile,
  IInvoiceHistory,
  INotification,
  IPaymentMark,
  PaymentMarkStatus,
  IUser,
  IUserSetting,
  IOrganizationUser,
} from '@/shared/types';

export function getOrganizations() {
  return pb.collection('organizations').getFullList<IOrganization>({ sort: 'created' });
}

export function createOrganization(name: string, color: string) {
  return pb.collection('organizations').create<IOrganization>({ name, color });
}

export function updateOrganization(id: string, name: string, color: string) {
  return pb.collection('organizations').update<IOrganization>(id, { name, color });
}

export function deleteOrganization(id: string) {
  return pb.collection('organizations').delete(id);
}

export function getAllBankAccounts() {
  return pb.collection('bank_accounts').getFullList<IBankAccount>({ sort: 'created' });
}

export function getBankAccounts(orgId: string) {
  return pb
    .collection('bank_accounts')
    .getFullList<IBankAccount>({ filter: `organization_id = "${orgId}"`, sort: 'created' });
}

export function createBankAccount(organizationId: string, accountNumber: string) {
  return pb.collection('bank_accounts').create<IBankAccount>({
    organization_id: organizationId,
    account_number: accountNumber,
  });
}

export function updateBankAccount(id: string, accountNumber: string) {
  return pb.collection('bank_accounts').update<IBankAccount>(id, { account_number: accountNumber });
}

export function deleteBankAccount(id: string) {
  return pb.collection('bank_accounts').delete(id);
}

// --- Balance History ---

export async function getBalancesForOrgDate(
  orgId: string,
  date: string,
): Promise<IAccountWithBalance[]> {
  const accounts = await pb.collection('bank_accounts').getFullList<IBankAccount>({
    filter: `organization_id = "${orgId}" && created <= "${date} 23:59:59"`,
    sort: 'created',
  });

  if (accounts.length === 0) return [];

  const accountIds = accounts.map((a) => a.id);
  const filter = accountIds.map((id) => `account_id = "${id}"`).join(' || ');
  const histories = await pb.collection('balance_history').getFullList<IBalanceHistory>({
    filter: `(${filter}) && date = "${date}"`,
  });

  return accounts.map((acc) => ({
    account: acc,
    balance: histories.find((h) => h.account_id === acc.id)?.balance ?? 0,
  }));
}

export async function upsertBalance(accountId: string, date: string, balance: number) {
  const existing = await pb.collection('balance_history').getFullList<IBalanceHistory>({
    filter: `account_id = "${accountId}" && date = "${date}"`,
    requestKey: `upsert-${accountId}-${date}`,
  });
  if (existing.length > 0) {
    return pb.collection('balance_history').update<IBalanceHistory>(existing[0]!.id, { balance });
  }
  return pb.collection('balance_history').create<IBalanceHistory>({
    account_id: accountId,
    date,
    balance,
  });
}

export function getAllAccountingObjects() {
  return pb.collection('accounting_objects').getFullList<IAccountingObject>({
    sort: 'sort,created',
  });
}

export function getAccountingObjects(orgId: string) {
  return pb.collection('accounting_objects').getFullList<IAccountingObject>({
    filter: `organization_id = "${orgId}"`,
    sort: 'sort,created',
  });
}

export async function createAccountingObject(organizationId: string, name: string) {
  const highest = await pb.collection('accounting_objects').getList<IAccountingObject>(1, 1, {
    filter: `organization_id = "${organizationId}" && sort != null`,
    sort: '-sort',
    fields: 'sort',
  });
  const maxSort = highest.items[0]?.sort ?? 0;

  return pb.collection('accounting_objects').create<IAccountingObject>({
    organization_id: organizationId,
    name,
    sort: maxSort + 1,
  });
}

export function updateAccountingObject(id: string, name: string) {
  return pb.collection('accounting_objects').update<IAccountingObject>(id, { name });
}

export function deleteAccountingObject(id: string) {
  return pb.collection('accounting_objects').delete(id);
}

export async function updateAccountingObjectsOrder(orderedIds: string[]) {
  return Promise.all(
    orderedIds.map((id, i) =>
      pb.collection('accounting_objects').update<IAccountingObject>(id, { sort: i + 1 }),
    ),
  );
}

export function getInvoices(orgId: string, date: string) {
  const today = date.slice(0, 10);

  return pb
    .collection('invoices')
    .getFullList<IInvoice>({
      filter: `organization_id = "${orgId}" && date <= "${today} 23:59:59" && (paid = false || (paid = true && (paid_date ~ "${today}" || paid_date > "${today}")) || (original_invoice_id != "" && date = "${today}"))`,
      sort: '-created',
    })
    .then((list) =>
      list.map(normalizeInvoice).map((inv) => {
        if (inv.paid && inv.paid_date > today) {
          return { ...inv, paid: false, paid_date: '', paid_amount: null, payment_amounts: [] };
        }
        return inv;
      }),
    );
}

export function getInvoice(invoiceId: string) {
  return pb.collection('invoices').getOne<IInvoice>(invoiceId).then(normalizeInvoice);
}

export async function countInvoicesByOrg(orgId: string): Promise<number> {
  const result = await pb.collection('invoices').getList(1, 1, {
    filter: `organization_id = "${orgId}"`,
  });
  return result.totalItems;
}

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
};

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
    })
    .then(normalizeInvoice);
}

export function getInvoiceCopies(originalInvoiceId: string) {
  return pb
    .collection('invoices')
    .getFullList<IInvoice>({
      filter: `original_invoice_id = "${originalInvoiceId}"`,
      sort: 'created',
    })
    .then((list) => list.map(normalizeInvoice));
}

async function deleteInvoiceTree(invoiceId: string) {
  const children = await getInvoiceCopies(invoiceId);
  for (const child of children) {
    await deleteInvoiceTree(child.id);
  }
  await deleteInvoice(invoiceId);
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

  const totalPaid = amounts.reduce((s, a) => s + (Number(a) || 0), 0);
  const remaining = (Number(source.amount) || 0) - totalPaid;
  if (remaining <= 0) return null;

  return createInvoice({
    organization_id: source.organization_id,
    accounting_object_id: source.accounting_object_id,
    date: payDate || source.date,
    counterparty: source.counterparty,
    purpose: source.purpose,
    contract_no: source.contract_no,
    invoice_no: source.invoice_no,
    amount: remaining,
    comment: source.comment,
    original_invoice_id: source.id,
    source_paid_amount: totalPaid,
    source_paid_date: payDate || source.date,
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

export function updateInvoice(id: string, data: Partial<IInvoice>) {
  return pb.collection('invoices').update<IInvoice>(id, data).then(normalizeInvoice);
}

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

export async function deleteInvoice(id: string) {
  const historyRecords = await pb.collection('invoice_history').getFullList<IInvoiceHistory>({
    filter: `invoice_id = "${id}"`,
  });
  await Promise.all(
    historyRecords.map((record) => pb.collection('invoice_history').delete(record.id)),
  );
  return pb.collection('invoices').delete(id);
}

export function getInvoiceHistory(invoiceId: string) {
  return pb.collection('invoice_history').getFullList<IInvoiceHistory>({
    filter: `invoice_id = "${invoiceId}"`,
    sort: '-changed_at',
  });
}

/**
 * Возвращает историю счёта вместе с историей всей цепочки «оригиналов»:
 * идёт от копии по original_invoice_id до исходного счёта и собирает
 * { invoice, history } для каждого звена.  Сбой чтения отдельного звена
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
  const results: { invoice: IInvoice; history: IInvoiceHistory[] }[] = [];
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

function getCurrentAuthor(): string {
  return pb.authStore.model?.name || pb.authStore.model?.email || 'unknown';
}

export function createInvoiceHistoryRecord(
  invoiceId: string,
  data: { type?: InvoiceHistoryType; previous_data: Record<string, unknown> },
) {
  return pb.collection('invoice_history').create<IInvoiceHistory>({
    invoice_id: invoiceId,
    author: getCurrentAuthor(),
    changed_at: new Date().toISOString(),
    type: data.type ?? '',
    previous_data: JSON.stringify(data.previous_data),
  });
}

export function createPaymentMarkHistory(
  invoiceId: string,
  type: 'mark_created' | 'mark_deleted',
  markData: Record<string, unknown>,
) {
  return createInvoiceHistoryRecord(invoiceId, { type, previous_data: markData });
}

// --- Payment Marks ---

export function getPaymentMarks(orgId: string) {
  return pb.collection('payment_marks').getFullList<IPaymentMark>({
    filter: `organization_id = "${orgId}"`,
    sort: '-created',
  });
}

export async function createPaymentMark(data: {
  invoice_id: string;
  organization_id: string;
  amount?: number | null;
  comment?: string;
  status?: PaymentMarkStatus;
}) {
  const mark = await pb.collection('payment_marks').create<IPaymentMark>({
    invoice_id: data.invoice_id,
    organization_id: data.organization_id,
    amount: data.amount ?? null,
    comment: data.comment ?? '',
    status: data.status,
    created_by: pb.authStore.model?.id,
  });

  await createPaymentMarkHistory(data.invoice_id, 'mark_created', {
    status: mark.status ?? null,
    amount: mark.amount,
    comment: mark.comment,
  });

  return mark;
}

export async function deletePaymentMark(id: string) {
  const mark = await pb.collection('payment_marks').getOne<IPaymentMark>(id);

  await createPaymentMarkHistory(mark.invoice_id, 'mark_deleted', {
    status: mark.status ?? null,
    amount: mark.amount,
    comment: mark.comment,
  });

  return pb.collection('payment_marks').delete(id);
}

// --- Users ---
export function getUsers() {
  return pb.collection('users').getFullList<IUser>({
    sort: 'created',
  });
}

export function createUser(login: string, password: string, name: string) {
  return pb.collection('users').create<IUser>({
    login,
    email: `${login}@local.host`,
    password,
    passwordConfirm: password,
    name,
    emailVisibility: false,
  });
}

export function deleteUser(id: string) {
  return pb.collection('users').delete(id);
}

// --- Organization Users ---
export function getOrganizationUsers() {
  return pb.collection('organization_users').getFullList<IOrganizationUser>({
    expand: 'user_id,organization_id',
    sort: 'created',
  });
}

export function createOrganizationUser(
  userId: string,
  organizationId: string,
  role: IOrganizationUser['role'],
  objectIds?: string[],
) {
  return pb.collection('organization_users').create<IOrganizationUser>({
    user_id: userId,
    organization_id: organizationId,
    role,
    objects: objectIds,
  });
}

export function updateOrganizationUser(
  id: string,
  data: { role?: IOrganizationUser['role']; objects?: string[] },
) {
  return pb.collection('organization_users').update<IOrganizationUser>(id, data);
}

export function deleteOrganizationUser(id: string) {
  return pb.collection('organization_users').delete(id);
}

// --- User Settings ---

export function getUserSetting(userId: string, key: string) {
  return pb
    .collection('user_settings')
    .getFirstListItem<IUserSetting>(`user_id = "${userId}" && key = "${key}"`);
}

export function upsertUserSetting(userId: string, key: string, value: unknown) {
  return pb
    .collection('user_settings')
    .getFirstListItem<IUserSetting>(`user_id = "${userId}" && key = "${key}"`)
    .then((existing) => pb.collection('user_settings').update<IUserSetting>(existing.id, { value }))
    .catch(() =>
      pb.collection('user_settings').create<IUserSetting>({
        user_id: userId,
        key,
        value,
      }),
    );
}

// --- Invoice Files ---

export function getInvoiceFilesByOrg(orgId: string) {
  return pb.collection('invoice_files').getFullList<IInvoiceFile>({
    filter: `organization_id = "${orgId}"`,
    sort: 'created',
  });
}

export function getInvoiceFiles(invoiceId: string) {
  return pb.collection('invoice_files').getFullList<IInvoiceFile>({
    filter: `invoice_id = "${invoiceId}"`,
    sort: 'created',
  });
}

export function createInvoiceFile(invoiceId: string, orgId: string, file: File, name: string) {
  const formData = new FormData();
  formData.append('invoice_id', invoiceId);
  formData.append('organization_id', orgId);
  formData.append('file', file);
  formData.append('name', name);
  return pb.collection('invoice_files').create<IInvoiceFile>(formData);
}

export function deleteInvoiceFile(id: string) {
  return pb.collection('invoice_files').delete(id);
}

export function getInvoiceFileUrl(fileRecord: IInvoiceFile) {
  return pb.files.getURL(fileRecord, fileRecord.file);
}

function stripInvisible(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[\u00a0\u2000-\u200f\u2028-\u202f\u205f\u3000\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

export function searchAllInvoices(orgId: string, text: string) {
  const clean = stripInvisible(text);
  return pb.collection('invoices').getFullList<IInvoice>({
    filter: `organization_id = "${orgId}" && (counterparty ~ "${clean}" || purpose ~ "${clean}" || contract_no ~ "${clean}" || invoice_no ~ "${clean}" || comment ~ "${clean}")`,
    sort: '-date',
  });
}

// --- Notifications ---

export const NOTIFICATIONS_PAGE_SIZE = 20;

export function getNotificationsPage(userId: string, beforeCreated?: string) {
  const filter = beforeCreated
    ? `user_id = "${userId}" && created < "${beforeCreated}"`
    : `user_id = "${userId}"`;
  return pb.collection('notifications').getList<INotification>(1, NOTIFICATIONS_PAGE_SIZE, {
    filter,
    sort: '-created',
  });
}

export function getNotificationsByDate(userId: string, date: string) {
  return pb.collection('notifications').getFullList<INotification>({
    filter: `user_id = "${userId}" && created >= "${date} 00:00:00" && created <= "${date} 23:59:59"`,
    sort: '-created',
  });
}

export function getUnreadNotificationsCount(userId: string) {
  return pb
    .collection('notifications')
    .getList<INotification>(1, 1, {
      filter: `user_id = "${userId}" && read = false`,
      fields: 'id',
    })
    .then((res) => res.totalItems);
}

export function markNotificationAsRead(id: string) {
  return pb.collection('notifications').update<INotification>(id, { read: true });
}
