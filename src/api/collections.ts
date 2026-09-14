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
  InvoiceHistoryType,
  INotification,
  IPaymentMark,
  PaymentMarkStatus,
  IUser,
  IUserSetting,
  IOrganizationUser,
  IDeletedInvoice,
  IDeletedInvoiceHistory,
  IDeletedInvoiceFile,
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

export function updateAccountingObjectCounterpartyOrder(
  objectId: string,
  counterpartyOrder: string[],
) {
  return pb
    .collection('accounting_objects')
    .update<IAccountingObject>(objectId, { counterparty_order: counterpartyOrder });
}

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
  source_created?: string;
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
      source_created: data.source_created || undefined,
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
  const invoice = await pb.collection('invoices').getOne<IInvoice>(id);

  const historyRecords = await pb.collection('invoice_history').getFullList<IInvoiceHistory>({
    filter: `invoice_id = "${id}"`,
  });

  const files = await pb.collection('invoice_files').getFullList<IInvoiceFile>({
    filter: `invoice_id = "${id}" && is_deleted != true`,
  });

  // Create archive record first — we need its ID for history/files
  const deletedInvoice = await pb.collection('deleted_invoices').create<IDeletedInvoice>({
    original_id: invoice.id,
    organization_id: invoice.organization_id,
    accounting_object_id: invoice.accounting_object_id,
    date: invoice.date,
    seq: invoice.seq,
    counterparty: invoice.counterparty,
    purpose: invoice.purpose,
    contract_no: invoice.contract_no,
    invoice_no: invoice.invoice_no,
    amount: invoice.amount,
    paid: invoice.paid,
    paid_date: invoice.paid_date,
    paid_amount: invoice.paid_amount,
    payment_amounts: invoice.payment_amounts,
    comment: invoice.comment,
    copy_comments: invoice.copy_comments,
    created_by: invoice.created_by,
    updated_by: invoice.updated_by,
    original_invoice_id: invoice.original_invoice_id || '',
    source_paid_amount: invoice.source_paid_amount,
    source_paid_date: invoice.source_paid_date,
    source_created: invoice.source_created,
    deleted_by: pb.authStore.model?.id ?? '',
    deleted_by_name: pb.authStore.model?.name || pb.authStore.model?.email || '',
    deleted_at: new Date().toISOString(),
  });

  await archiveDeletedInvoiceHistory(deletedInvoice.id, historyRecords);
  await archiveDeletedInvoiceFiles(deletedInvoice.id, files);

  await pb.collection('deleted_invoice_history').create<IDeletedInvoiceHistory>({
    deleted_invoice_id: deletedInvoice.id,
    author: getCurrentAuthor(),
    changed_at: new Date().toISOString(),
    previous_data: {
      deleted_by: deletedInvoice.deleted_by,
      deleted_by_name: deletedInvoice.deleted_by_name,
      deleted_at: deletedInvoice.deleted_at,
    },
    type: 'invoice_deleted',
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
    previous_data: data.previous_data,
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

export interface UpdateUserData {
  name?: string;
  login?: string;
  password?: string;
}

export function updateUser(id: string, data: UpdateUserData) {
  const payload: Record<string, string> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.login !== undefined) {
    payload.login = data.login;
    payload.email = `${data.login}@local.host`;
  }
  if (data.password) {
    payload.password = data.password;
    payload.passwordConfirm = data.password;
  }
  return pb.collection('users').update<IUser>(id, payload);
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
    filter: `organization_id = "${orgId}" && is_deleted != true`,
    sort: 'created',
  });
}

export function getInvoiceFiles(invoiceId: string) {
  return pb.collection('invoice_files').getFullList<IInvoiceFile>({
    filter: `invoice_id = "${invoiceId}" && is_deleted != true`,
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

export function softDeleteInvoiceFile(id: string) {
  return pb.collection('invoice_files').update<IInvoiceFile>(id, {
    is_deleted: true,
    deleted_at: new Date().toISOString(),
  });
}

export function getInvoiceFileUrl(fileRecord: IInvoiceFile) {
  return pb.files.getURL(fileRecord, fileRecord.file);
}

export function getInvoiceFileDownloadUrl(data: { file_id: string; file: string }) {
  return pb.files.getURL({ id: data.file_id, collectionName: 'invoice_files' }, data.file);
}

// --- Deleted Invoices (Archive) ---

export const ARCHIVE_PAGE_SIZE = 15;

async function archiveDeletedInvoiceHistory(
  deletedInvoiceId: string,
  history: IInvoiceHistory[],
) {
  for (const h of history) {
    try {
      await pb.collection('deleted_invoice_history').create<IDeletedInvoiceHistory>({
        deleted_invoice_id: deletedInvoiceId,
        author: h.author,
        changed_at: h.changed_at,
        previous_data: h.previous_data,
        type: h.type || '',
      });
    } catch {
      // history archival is best-effort
    }
  }
}

async function archiveDeletedInvoiceFiles(invoiceId: string, files: IInvoiceFile[]) {
  for (const f of files) {
    const url = getInvoiceFileUrl(f);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const fileObj = new File([blob], f.name);
      const formData = new FormData();
      formData.append('deleted_invoice_id', invoiceId);
      formData.append('file', fileObj);
      formData.append('name', f.name);
      formData.append('original_file_id', f.id);
      await pb.collection('deleted_invoice_files').create<IDeletedInvoiceFile>(formData);
    } catch {
      // file archival is best-effort
    }
  }
}

export function getDeletedInvoices(orgId: string, page: number, perPage: number) {
  return pb.collection('deleted_invoices').getList<IDeletedInvoice>(page, perPage, {
    filter: `organization_id = "${orgId}"`,
    sort: '-deleted_at',
    expand: 'accounting_object_id',
  });
}

export function searchDeletedInvoices(
  orgId: string,
  query: string,
  page: number,
  perPage: number,
) {
  const clean = query.trim();
  if (!clean) return getDeletedInvoices(orgId, page, perPage);
  return pb.collection('deleted_invoices').getList<IDeletedInvoice>(page, perPage, {
    filter: `organization_id = "${orgId}" && (counterparty ~ "${clean}" || purpose ~ "${clean}" || invoice_no ~ "${clean}")`,
    sort: '-deleted_at',
    expand: 'accounting_object_id',
  });
}

export function getDeletedInvoiceHistory(deletedInvoiceId: string) {
  return pb.collection('deleted_invoice_history').getFullList<IDeletedInvoiceHistory>({
    filter: `deleted_invoice_id = "${deletedInvoiceId}"`,
    sort: 'changed_at',
  });
}

export function getDeletedInvoiceFiles(deletedInvoiceId: string) {
  return pb.collection('deleted_invoice_files').getFullList<IDeletedInvoiceFile>({
    filter: `deleted_invoice_id = "${deletedInvoiceId}"`,
  });
}

export function getDeletedInvoiceFileUrl(record: IDeletedInvoiceFile) {
  return pb.files.getURL(record, record.file);
}

export async function restoreDeletedInvoice(
  deletedInvoiceId: string,
): Promise<IInvoice> {
  const deleted = await pb
    .collection('deleted_invoices')
    .getOne<IDeletedInvoice>(deletedInvoiceId);

  // 1. Create new invoice (seq will be auto-numbered)
  const newInvoice = await pb
    .collection('invoices')
    .create<IInvoice>({
      organization_id: deleted.organization_id,
      accounting_object_id: deleted.accounting_object_id,
      date: deleted.date,
      counterparty: deleted.counterparty,
      purpose: deleted.purpose,
      contract_no: deleted.contract_no,
      invoice_no: deleted.invoice_no,
      amount: deleted.amount,
      paid: deleted.paid,
      paid_date: deleted.paid_date,
      comment: deleted.comment,
      original_invoice_id: deleted.original_invoice_id || '',
      source_paid_amount: deleted.source_paid_amount,
      source_paid_date: deleted.source_paid_date,
      source_created: deleted.source_created || undefined,
    })
    .then(normalizeInvoice);

  // 2. Restore history
  const history = await pb
    .collection('deleted_invoice_history')
    .getFullList<IDeletedInvoiceHistory>({
      filter: `deleted_invoice_id = "${deletedInvoiceId}"`,
    });
  for (const h of history) {
    await pb.collection('invoice_history').create<IInvoiceHistory>({
      invoice_id: newInvoice.id,
      author: h.author,
      changed_at: h.changed_at,
      previous_data: h.previous_data,
      type: h.type as InvoiceHistoryType,
    });
  }

  // Record the restore event in the new invoice's history
  await createInvoiceHistoryRecord(newInvoice.id, {
    type: 'invoice_restored',
    previous_data: {
      deleted_by: deleted.deleted_by,
      deleted_by_name: deleted.deleted_by_name,
      deleted_at: deleted.deleted_at,
    },
  });

  // 3. Restore files
  const deletedFiles = await pb
    .collection('deleted_invoice_files')
    .getFullList<IDeletedInvoiceFile>({
      filter: `deleted_invoice_id = "${deletedInvoiceId}"`,
    });
  for (const df of deletedFiles) {
    try {
      const url = getDeletedInvoiceFileUrl(df);
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], df.name);
      await createInvoiceFile(newInvoice.id, deleted.organization_id, file, df.name);
    } catch {
      // file restore is best-effort
    }
  }

  // 4. Delete from archive
  await pb.collection('deleted_invoice_history').unsubscribe('*');
  const archiveHistory = await pb
    .collection('deleted_invoice_history')
    .getFullList({ filter: `deleted_invoice_id = "${deletedInvoiceId}"` });
  await Promise.all(
    archiveHistory.map((r) => pb.collection('deleted_invoice_history').delete(r.id)),
  );
  const archiveFiles = await pb
    .collection('deleted_invoice_files')
    .getFullList({ filter: `deleted_invoice_id = "${deletedInvoiceId}"` });
  await Promise.all(
    archiveFiles.map((r) => pb.collection('deleted_invoice_files').delete(r.id)),
  );
  await pb.collection('deleted_invoices').delete(deletedInvoiceId);

  return newInvoice;
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
