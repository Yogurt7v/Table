/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/accounting-objects`:
 * реализация живёт в домене `@/features/accounts/api`.
 */

export {
  getAllAccountingObjects,
  getAccountingObjects,
  createAccountingObject,
  updateAccountingObject,
  deleteAccountingObject,
  updateAccountingObjectsOrder,
  updateAccountingObjectCounterpartyOrder,
} from '@/features/accounts/api/accounting-objects';
