import { randomBytes } from 'node:crypto';
import dayjs from 'dayjs';
import 'dayjs/locale/ru.js';
import type { RecordModel } from 'pocketbase';
import type PocketBase from 'pocketbase';
import { E2E_PASSWORD, E2E_USERS } from '../data';
import { pbAdmin } from './pb';

dayjs.locale('ru');

export const HUMAN_ORG_PREFIX = 'ХТ';
export const HUMAN_OBJ_PREFIX = 'Объект';
export const HUMAN_ACC_PREFIX = '40817';

export type HumanKind = 'admin' | 'moderator' | 'user' | 'boss';

export function humanOrgName(marker: string): string {
  return `${HUMAN_ORG_PREFIX}-${marker}`;
}

export function humanLogin(marker: string, kind: HumanKind): string {
  return `ht_${kind}_${marker}`;
}

export function humanObjectName(marker: string, index: number): string {
  return `${HUMAN_OBJ_PREFIX} ${index} ${marker}`;
}

export function humanAccountNumber(marker: string, index: number): string {
  return `${HUMAN_ACC_PREFIX}${marker.replace(/\D/g, '').slice(-9)}${index}`;
}

export function humanUserName(marker: string, kind: HumanKind): string {
  return `${kind} ${marker}`;
}

export function humanInvoiceCounterparty(marker: string): string {
  return `Контрагент ${marker}`;
}

export function humanCopyCounterparty(marker: string): string {
  return `Копия ${marker}`;
}

function localIsoDate(base: dayjs.Dayjs, offsetDays: number): string {
  return base.add(offsetDays, 'day').format('YYYY-MM-DD');
}

export function humanDates(): { D: string; D7: string; D8: string; D9: string; today: string } {
  const d = dayjs().subtract(1, 'month');
  return {
    D: d.format('YYYY-MM-DD'),
    D7: localIsoDate(d, 7),
    D8: localIsoDate(d, 8),
    D9: localIsoDate(d, 9),
    today: dayjs().format('YYYY-MM-DD'),
  };
}

export function humanDayLabel(iso: string): string {
  return dayjs(iso).format('D MMMM YYYY');
}

export function humanMonthLabel(iso: string): string {
  return dayjs(iso).format('MMMM YYYY');
}

export function humanShortMonth(iso: string): string {
  return dayjs(iso).format('MMM');
}

export function humanYear(iso: string): string {
  return dayjs(iso).format('YYYY');
}

export function humanDateButtonLabel(iso: string): string {
  return dayjs(iso).format('D MMMM YYYY, dddd');
}

export function humanIsoDate(value: unknown): string {
  return dayjs(String(value ?? '')).format('YYYY-MM-DD');
}

export interface HumanFixture {
  marker: string;
  orgId: string;
  objectIds: string[];
  bankAccountIds: string[];
  logins: Record<HumanKind, string>;
  ids: Record<HumanKind, string>;
  guestId: string;
  dates: ReturnType<typeof humanDates>;
}

async function firstByFilter(
  pb: PocketBase,
  collection: string,
  filter: string,
): Promise<RecordModel | undefined> {
  const items = await pb.collection(collection).getFullList({ filter, perPage: 1 });
  return items[0];
}

async function ignoreMissing(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    return;
  }
}

export async function getUserByLogin(login: string): Promise<RecordModel> {
  const pb = pbAdmin();
  const user = await firstByFilter(pb, 'users', `login = "${login}"`);
  if (!user) throw new Error(`Пользователь ${login} не найден`);
  return user;
}

async function ensureUser(pb: PocketBase, login: string, name: string): Promise<RecordModel> {
  const existing = await firstByFilter(pb, 'users', `login = "${login}"`);
  if (existing) return existing;
  return pb.collection('users').create({
    login,
    name,
    email: `${login}@local.host`,
    password: E2E_PASSWORD,
    passwordConfirm: E2E_PASSWORD,
    tokenKey: randomBytes(30).toString('hex'),
  });
}

async function ensureMembership(
  pb: PocketBase,
  userId: string,
  orgId: string,
  role: string,
  objectIds: string[],
  canCreateInvoices: boolean,
): Promise<void> {
  const existing = await firstByFilter(
    pb,
    'organization_users',
    `user_id = "${userId}" && organization_id = "${orgId}"`,
  );
  const payload = {
    user_id: userId,
    organization_id: orgId,
    role,
    objects: objectIds,
    can_create_invoices: canCreateInvoices,
  };
  if (existing) {
    await pb.collection('organization_users').update(existing.id, payload);
    return;
  }
  await pb.collection('organization_users').create(payload);
}

export async function forceDeleteInvoices(pb: PocketBase, orgId: string): Promise<void> {
  const invoices = await pb
    .collection('invoices')
    .getFullList({ filter: `organization_id = "${orgId}"` });
  for (const invoice of invoices) {
    const children: [string, string][] = [
      ['payment_marks', `invoice_id = "${invoice.id}"`],
      ['invoice_files', `invoice_id = "${invoice.id}"`],
      ['invoice_history', `invoice_id = "${invoice.id}"`],
    ];
    for (const [collection, filter] of children) {
      const records = await pb.collection(collection).getFullList({ filter });
      for (const record of records) {
        await ignoreMissing(() => pb.collection(collection).delete(record.id));
      }
    }
  }
  for (const invoice of invoices) {
    await ignoreMissing(() => pb.collection('invoices').delete(invoice.id));
  }
}

export async function purgeArchivedInvoices(orgId: string): Promise<number> {
  const pb = pbAdmin();
  const archived = await pb
    .collection('deleted_invoices')
    .getFullList({ filter: `organization_id = "${orgId}"` });
  for (const record of archived) {
    for (const collection of ['deleted_invoice_history', 'deleted_invoice_files']) {
      const children = await pb
        .collection(collection)
        .getFullList({ filter: `deleted_invoice_id = "${record.id}"` });
      for (const child of children) {
        await ignoreMissing(() => pb.collection(collection).delete(child.id));
      }
    }
  }
  for (const record of archived) {
    await ignoreMissing(() => pb.collection('deleted_invoices').delete(record.id));
  }
  return archived.length;
}

export async function forceDeleteOrganization(pb: PocketBase, orgId: string): Promise<void> {
  await forceDeleteInvoices(pb, orgId);

  const archived = await pb
    .collection('deleted_invoices')
    .getFullList({ filter: `organization_id = "${orgId}"` });
  for (const record of archived) {
    for (const collection of ['deleted_invoice_history', 'deleted_invoice_files']) {
      const children = await pb
        .collection(collection)
        .getFullList({ filter: `deleted_invoice_id = "${record.id}"` });
      for (const child of children) {
        await ignoreMissing(() => pb.collection(collection).delete(child.id));
      }
    }
  }
  for (const record of archived) {
    await ignoreMissing(() => pb.collection('deleted_invoices').delete(record.id));
  }

  const accounts = await pb
    .collection('bank_accounts')
    .getFullList({ filter: `organization_id = "${orgId}"` });
  for (const account of accounts) {
    const balances = await pb
      .collection('balance_history')
      .getFullList({ filter: `account_id = "${account.id}"` });
    for (const balance of balances) {
      await ignoreMissing(() => pb.collection('balance_history').delete(balance.id));
    }
  }
  for (const account of accounts) {
    await ignoreMissing(() => pb.collection('bank_accounts').delete(account.id));
  }

  for (const collection of ['accounting_objects', 'notifications', 'organization_users']) {
    const records = await pb
      .collection(collection)
      .getFullList({ filter: `organization_id = "${orgId}"` });
    for (const record of records) {
      await ignoreMissing(() => pb.collection(collection).delete(record.id));
    }
  }

  await ignoreMissing(() => pb.collection('organizations').delete(orgId));
}

export async function cleanupHumanFlow(marker: string): Promise<void> {
  const pb = pbAdmin();
  const orgName = humanOrgName(marker);

  const orgs = await pb.collection('organizations').getFullList({ filter: `name = "${orgName}"` });
  for (const org of orgs) {
    await forceDeleteOrganization(pb, org.id);
  }

  const logins = (['admin', 'moderator', 'user', 'boss'] as HumanKind[]).map((kind) =>
    humanLogin(marker, kind),
  );
  const filter = logins.map((login) => `login = "${login}"`).join(' || ');
  const users = await pb.collection('users').getFullList({ filter });
  for (const user of users) {
    await ignoreMissing(() => pb.collection('users').delete(user.id));
  }
}

export async function bootstrapHumanFlow(marker: string): Promise<HumanFixture> {
  await cleanupHumanFlow(marker);

  const pb = pbAdmin();
  const objectNames = [1, 2, 3].map((i) => humanObjectName(marker, i));

  const org = await pb.collection('organizations').create({
    name: humanOrgName(marker),
    color: '#228be6',
  });

  const objects: RecordModel[] = [];
  for (let i = 0; i < objectNames.length; i++) {
    objects.push(
      await pb.collection('accounting_objects').create({
        organization_id: org.id,
        name: objectNames[i],
        sort: i + 1,
        counterparty_order: [],
      }),
    );
  }

  const bankAccounts: RecordModel[] = [];
  for (let i = 0; i < 3; i++) {
    bankAccounts.push(
      await pb.collection('bank_accounts').create({
        organization_id: org.id,
        account_number: humanAccountNumber(marker, i + 1),
      }),
    );
  }

  const guest = await getUserByLogin(E2E_USERS.guest.login);

  const kinds: HumanKind[] = ['admin', 'moderator', 'user'];
  const logins = {} as Record<HumanKind, string>;
  const ids = {} as Record<HumanKind, string>;
  for (const kind of kinds) {
    const login = humanLogin(marker, kind);
    const user = await ensureUser(pb, login, humanUserName(marker, kind));
    logins[kind] = login;
    ids[kind] = user.id;
  }
  logins.boss = humanLogin(marker, 'boss');
  ids.boss = '';

  const objectIds = objects.map((o) => o.id);
  for (const kind of kinds) {
    await ensureMembership(pb, ids[kind], org.id, kind, objectIds, true);
  }
  await ensureMembership(pb, guest.id, org.id, 'guest', objectIds, false);

  return {
    marker,
    orgId: org.id,
    objectIds,
    bankAccountIds: bankAccounts.map((a) => a.id),
    logins,
    ids,
    guestId: guest.id,
    dates: humanDates(),
  };
}

export async function getMembership(
  userId: string,
  orgId: string,
): Promise<RecordModel | undefined> {
  return firstByFilter(
    pbAdmin(),
    'organization_users',
    `user_id = "${userId}" && organization_id = "${orgId}"`,
  );
}

export async function getInvoicesByCounterparty(
  counterparty: string,
  orgId?: string,
): Promise<RecordModel[]> {
  const pb = pbAdmin();
  const orgFilter = orgId ? ` && organization_id = "${orgId}"` : '';
  return pb
    .collection('invoices')
    .getFullList({ filter: `counterparty = "${counterparty}"${orgFilter}`, sort: 'created' });
}

export async function getInvoiceCopies(invoiceId: string): Promise<RecordModel[]> {
  return pbAdmin()
    .collection('invoices')
    .getFullList({ filter: `original_invoice_id = "${invoiceId}"`, sort: 'created' });
}

export async function getInvoiceHistory(invoiceId: string): Promise<RecordModel[]> {
  return pbAdmin()
    .collection('invoice_history')
    .getFullList({ filter: `invoice_id = "${invoiceId}"`, sort: 'created' });
}

export async function getInvoiceFiles(invoiceId: string): Promise<RecordModel[]> {
  return pbAdmin()
    .collection('invoice_files')
    .getFullList({ filter: `invoice_id = "${invoiceId}" && is_deleted != true`, sort: 'created' });
}

export async function getPaymentMarksOf(invoiceId: string): Promise<RecordModel[]> {
  return pbAdmin()
    .collection('payment_marks')
    .getFullList({ filter: `invoice_id = "${invoiceId}"`, sort: 'created' });
}

export async function authAsLogin(login: string, password = E2E_PASSWORD): Promise<PocketBase> {
  const pb = pbAdmin();
  await pb.collection('users').authWithPassword(login, password);
  return pb;
}

export async function getNotificationsOf(login: string): Promise<RecordModel[]> {
  const pb = await authAsLogin(login);
  return pb.collection('notifications').getFullList({ sort: 'created' });
}

export async function getArchiveByOriginalId(originalId: string): Promise<RecordModel> {
  const pb = pbAdmin();
  const item = await firstByFilter(pb, 'deleted_invoices', `original_id = "${originalId}"`);
  if (!item) throw new Error(`Архив для счёта ${originalId} не найден`);
  return item;
}

export async function getArchivedHistory(deletedInvoiceId: string): Promise<RecordModel[]> {
  return pbAdmin()
    .collection('deleted_invoice_history')
    .getFullList({ filter: `deleted_invoice_id = "${deletedInvoiceId}"`, sort: 'created' });
}

export async function getObjectsByOrg(orgId: string): Promise<RecordModel[]> {
  return pbAdmin()
    .collection('accounting_objects')
    .getFullList({ filter: `organization_id = "${orgId}"`, sort: 'sort' });
}

export async function getObjectNamesByOrg(orgId: string): Promise<string[]> {
  return (await getObjectsByOrg(orgId)).map((o) => String(o.name));
}

export async function getAccountsByOrg(orgId: string): Promise<RecordModel[]> {
  return pbAdmin()
    .collection('bank_accounts')
    .getFullList({ filter: `organization_id = "${orgId}"`, sort: 'created' });
}

export async function getAccountNumbersByOrg(orgId: string): Promise<string[]> {
  return (await getAccountsByOrg(orgId)).map((a) => String(a.account_number));
}

export async function getInvoicesByOrg(orgId: string): Promise<RecordModel[]> {
  return pbAdmin()
    .collection('invoices')
    .getFullList({ filter: `organization_id = "${orgId}"`, sort: 'created' });
}

export async function getInvoicesCreatedBy(userId: string, orgId: string): Promise<RecordModel[]> {
  return pbAdmin()
    .collection('invoices')
    .getFullList({ filter: `created_by = "${userId}" && organization_id = "${orgId}"` });
}

export async function setMembershipRole(
  userId: string,
  orgId: string,
  role: string,
): Promise<void> {
  const membership = await getMembership(userId, orgId);
  if (!membership) throw new Error(`Membership ${userId}/${orgId} не найден`);
  await pbAdmin().collection('organization_users').update(membership.id, { role });
}

export async function setMembershipObjects(
  userId: string,
  orgId: string,
  objectIds: string[],
): Promise<void> {
  const membership = await getMembership(userId, orgId);
  if (!membership) throw new Error(`Membership ${userId}/${orgId} не найден`);
  await pbAdmin().collection('organization_users').update(membership.id, { objects: objectIds });
}

export async function getOrgByName(name: string): Promise<RecordModel> {
  const org = await firstByFilter(pbAdmin(), 'organizations', `name = "${name}"`);
  if (!org) throw new Error(`Организация ${name} не найдена`);
  return org;
}

export function humanAmountPattern(amount: unknown): RegExp {
  const digits = String(amount ?? '').replace(/\D/g, '');
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  if (groups.length === 0) return /\d/;
  return new RegExp(`(?:^|\\D)${groups.join('[^0-9]*')}(?:\\D|$)`);
}
