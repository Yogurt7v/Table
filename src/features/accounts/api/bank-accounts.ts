/** Банковские счета организаций и история остатков по дням. */

import { pb } from '@/api/client';
import type { IAccountWithBalance, IBalanceHistory, IBankAccount } from '@/shared/types';

/** Возвращает все банковские счета (без фильтра по организации). */
export function getAllBankAccounts() {
  return pb.collection('bank_accounts').getFullList<IBankAccount>({ sort: 'created' });
}

/** Возвращает банковские счета организации. */
export function getBankAccounts(orgId: string) {
  return pb
    .collection('bank_accounts')
    .getFullList<IBankAccount>({ filter: `organization_id = "${orgId}"`, sort: 'created' });
}

/** Создаёт банковский счёт в организации. */
export function createBankAccount(organizationId: string, accountNumber: string) {
  return pb.collection('bank_accounts').create<IBankAccount>({
    organization_id: organizationId,
    account_number: accountNumber,
  });
}

/** Обновляет номер банковского счёта. */
export function updateBankAccount(id: string, accountNumber: string) {
  return pb.collection('bank_accounts').update<IBankAccount>(id, { account_number: accountNumber });
}

/** Удаляет банковский счёт. */
export function deleteBankAccount(id: string) {
  return pb.collection('bank_accounts').delete(id);
}

// --- Balance History ---

/** Возвращает счета организации с остатками на указанную дату. */
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

/** Создаёт или обновляет остаток счёта на дату (upsert по account_id+date). */
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
