/**
 * Barrel-реэкспорт доменных типов проекта.
 * Определения распределены по папкам основных модулей, а этот файл сохраняет
 * совместимость существующих импортов из `@/shared/types`.
 */

/** Организации, объекты учёта, пользователи, настройки и членства организаций. */
export type {
  IAccountingObject,
  IOrganization,
  IOrganizationUser,
  IUser,
  IUserSetting,
} from '@/features/admin/types';

/** Банковские счета и остатки. */
export type { IAccountWithBalance, IBalanceHistory, IBankAccount } from '@/features/accounts/types';

/** Счета, файлы, история, отметки оплаты и удалённые счета. */
export type {
  IDeletedInvoice,
  IDeletedInvoiceFile,
  IDeletedInvoiceHistory,
  IInvoice,
  IInvoiceFile,
  IInvoiceHistory,
  IPaymentMark,
  InvoiceColumnId,
  InvoiceHistoryType,
  PaymentMarkStatus,
} from '@/features/invoices/types';

/** Уведомления. */
export type { INotification } from '@/features/notifications/types';

/** Документы и связанные сущности. */
export type {
  DocumentColumnId,
  DocumentCreationMode,
  DocumentHistoryType,
  DocumentListParams,
  DocumentSourceInfo,
  IDocument,
  IDocumentComment,
  IDocumentFile,
  IDocumentHistory,
} from '@/features/documents/types';

/** Почтовая корреспонденция: типы. */
export type {
  DeliveryMethod,
  IDeletedIncomingMail,
  IDeletedMailBase,
  IDeletedMailHistory,
  IDeletedOutgoingMail,
  IIncomingMail,
  IMailActorFields,
  IMailFile,
  IMailHistory,
  IMailRelation,
  IOutgoingMail,
  MailHistoryType,
  MailListParams,
  MailPermissionFlags,
  MailRelationSide,
  MailType,
} from '@/features/mail/types';

/** Почтовая корреспонденция: константы способов доставки. */
export { MAIL_DELIVERY_METHOD_EMOJI, MAIL_DELIVERY_METHOD_NAMES } from '@/features/mail/types';
