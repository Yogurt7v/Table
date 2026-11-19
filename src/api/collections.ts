/**
 * Публичный API коллекций PocketBase: barrel-реэкспорт функций и типов из `src/api/collections/*`.
 * Сохранён путь импорта `@/api/collections` и состав экспортов исходного монолита.
 */

export {
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from './collections/organizations.ts';

export {
  getAllBankAccounts,
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBalancesForOrgDate,
  upsertBalance,
} from './collections/bank-accounts.ts';

export {
  getAllAccountingObjects,
  getAccountingObjects,
  createAccountingObject,
  updateAccountingObject,
  deleteAccountingObject,
  updateAccountingObjectsOrder,
  updateAccountingObjectCounterpartyOrder,
} from './collections/accounting-objects.ts';

export type { CreateInvoiceInput } from './collections/invoices.ts';
export {
  getInvoices,
  getInvoice,
  countInvoicesByOrg,
  searchCounterparties,
  createInvoice,
  getInvoiceCopies,
  getRootOriginalCreated,
  syncInvoiceCopy,
  updateInvoice,
  updateInvoiceWithHistory,
  getInvoiceHistoryChain,
  getAllInvoices,
  findDuplicateInvoices,
} from './collections/invoices.ts';

export {
  getInvoiceHistory,
  createInvoiceHistoryRecord,
  createPaymentMarkHistory,
} from './collections/invoice-history.ts';

export {
  getPaymentMarks,
  createPaymentMark,
  deletePaymentMark,
  approvePaymentMark,
} from './collections/payment-marks.ts';

export type { UpdateUserData } from './collections/users.ts';
export { getUsers, createUser, deleteUser, updateUser } from './collections/users.ts';

export {
  getOrganizationUsers,
  createOrganizationUser,
  updateOrganizationUser,
  deleteOrganizationUser,
} from './collections/organization-users.ts';

export { getUserSetting, upsertUserSetting } from './collections/user-settings.ts';

export {
  getInvoiceFilesByOrg,
  getInvoiceFiles,
  createInvoiceFile,
  softDeleteInvoiceFile,
  getInvoiceFileUrl,
  getInvoiceFileDownloadUrl,
} from './collections/invoice-files.ts';

export {
  ARCHIVE_PAGE_SIZE,
  deleteInvoice,
  getDeletedInvoices,
  getDeletedInvoiceById,
  getDeletedInvoiceByOriginalId,
  getAllDeletedInvoices,
  getDeletedInvoiceHistory,
  getDeletedInvoiceFiles,
  getDeletedInvoiceFileUrl,
  restoreDeletedInvoice,
} from './collections/invoices-archive.ts';

export {
  NOTIFICATIONS_PAGE_SIZE,
  getNotificationsPage,
  getNotificationsByDate,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './collections/notifications.ts';
