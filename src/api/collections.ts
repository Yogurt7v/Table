import { pb } from './client.ts';
import { invoiceDateFilter, normalizeInvoice } from '@/shared/utils/normalize-invoice';
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
  return pb.collection('accounting_objects').getFullList<IAccountingObject>({ sort: 'created' });
}

export function getAccountingObjects(orgId: string) {
  return pb.collection('accounting_objects').getFullList<IAccountingObject>({
    filter: `organization_id = "${orgId}"`,
    sort: 'created',
  });
}

export function createAccountingObject(organizationId: string, name: string) {
  return pb.collection('accounting_objects').create<IAccountingObject>({
    organization_id: organizationId,
    name,
  });
}

export function updateAccountingObject(id: string, name: string) {
  return pb.collection('accounting_objects').update<IAccountingObject>(id, { name });
}

export function deleteAccountingObject(id: string) {
  return pb.collection('accounting_objects').delete(id);
}

export function getInvoices(orgId: string, date: string) {
  const today = date.slice(0, 10);

  return pb
    .collection('invoices')
    .getFullList<IInvoice>({
      filter: `organization_id = "${orgId}" && date <= "${today} 23:59:59" && (paid = false || (paid = true && paid_date ~ "${today}"))`,
      sort: '-created',
    })
    .then((list) => list.map(normalizeInvoice));
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
    })
    .then(normalizeInvoice);
}

export function updateInvoice(id: string, data: Partial<IInvoice>) {
  return pb.collection('invoices').update<IInvoice>(id, data).then(normalizeInvoice);
}

export async function updateInvoiceWithHistory(
  id: string,
  data: Partial<IInvoice>,
  previousData: Record<string, unknown>,
) {
  // Записываем историю
  const author = pb.authStore.model?.name || pb.authStore.model?.email || 'unknown';
  await pb.collection('invoice_history').create({
    invoice_id: id,
    author,
    changed_at: new Date().toISOString(),
    previous_data: JSON.stringify(previousData),
  });

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

// --- Payment Marks ---

export function getPaymentMarks(orgId: string) {
  return pb.collection('payment_marks').getFullList<IPaymentMark>({
    filter: `organization_id = "${orgId}"`,
    sort: '-created',
  });
}

export function createPaymentMark(data: {
  invoice_id: string;
  organization_id: string;
  amount?: number | null;
  comment?: string;
}) {
  return pb.collection('payment_marks').create<IPaymentMark>({
    invoice_id: data.invoice_id,
    organization_id: data.organization_id,
    amount: data.amount ?? null,
    comment: data.comment ?? '',
    created_by: pb.authStore.model?.id,
  });
}

export function deletePaymentMark(id: string) {
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

export function updateOrganizationUser(id: string, data: { role?: IOrganizationUser['role']; objects?: string[] }) {
  return pb.collection('organization_users').update<IOrganizationUser>(id, data);
}

export function deleteOrganizationUser(id: string) {
  return pb.collection('organization_users').delete(id);
}

// --- User Settings ---

export function getUserSetting(userId: string, key: string) {
  return pb.collection('user_settings').getFirstListItem<IUserSetting>(
    `user_id = "${userId}" && key = "${key}"`,
  );
}

export function upsertUserSetting(
  userId: string,
  key: string,
  value: unknown,
) {
  return pb.collection('user_settings').getFirstListItem<IUserSetting>(
    `user_id = "${userId}" && key = "${key}"`,
  )
    .then((existing) =>
      pb.collection('user_settings').update<IUserSetting>(existing.id, { value }),
    )
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
  return pb.files.getUrl(fileRecord, fileRecord.file);
}

export function searchAllInvoices(orgId: string, text: string) {
  return pb.collection('invoices').getFullList<IInvoice>({
    filter: `organization_id = "${orgId}" && (counterparty ~ "${text}" || purpose ~ "${text}" || contract_no ~ "${text}" || invoice_no ~ "${text}" || comment ~ "${text}")`,
    sort: '-date',
  });
}

// --- Notifications ---

export function getNotifications(userId: string) {
  return pb.collection('notifications').getList<INotification>(1, 50, {
    filter: `user_id = "${userId}"`,
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
