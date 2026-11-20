/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/bank-accounts`:
 * реализация живёт в домене `@/features/accounts/api`.
 */

export {
  getAllBankAccounts,
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBalancesForOrgDate,
  upsertBalance,
} from '@/features/accounts/api/bank-accounts';
