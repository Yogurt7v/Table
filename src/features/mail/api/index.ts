/**
 * Публичный API почты: barrel-реэкспорт констант и функций из модулей `src/features/mail/api/*`.
 * Сохранён состав экспортов исходного монолита; путь `@/api/mail` реэкспортирует этот barrel.
 */

export {
  MAIL_INCOMING_COLLECTION,
  MAIL_OUTGOING_COLLECTION,
  MAIL_FILES_COLLECTION,
  MAIL_HISTORY_COLLECTION,
  MAIL_RELATIONS_COLLECTION,
  DELETED_MAIL_INCOMING_COLLECTION,
  DELETED_MAIL_OUTGOING_COLLECTION,
  DELETED_MAIL_HISTORY_COLLECTION,
  ORGANIZATION_USERS_COLLECTION,
  MAIL_PAGE_SIZE,
  LIVE_MAIL_SORT,
  LIVE_MAIL_SORT_ASC,
} from './constants.ts';

export {
  getIncomingMails,
  getOutgoingMails,
  getAllIncomingMails,
  getIncomingMail,
  getAllOutgoingMails,
  getOutgoingMail,
} from './registers.ts';

export { mergeCounterpartyVocabulary, getOrgCounterpartyVocabulary } from './vocabulary.ts';

export type { CreateIncomingMailInput, CreateOutgoingMailInput } from './mutations.ts';
export {
  createIncomingMail,
  createOutgoingMail,
  updateIncomingMail,
  updateOutgoingMail,
} from './mutations.ts';

export type { CreateMailHistoryParams } from './history.ts';
export {
  createMailHistory,
  getIncomingMailHistory,
  getOutgoingMailHistory,
  getDeletedIncomingMailHistory,
  getDeletedOutgoingMailHistory,
} from './history.ts';

export {
  deleteIncomingMail,
  deleteOutgoingMail,
  getDeletedIncomingMails,
  getDeletedOutgoingMails,
  getDeletedIncomingMail,
  getDeletedOutgoingMail,
  getAllDeletedIncomingMails,
  getAllDeletedOutgoingMails,
} from './archive.ts';

export { restoreDeletedIncomingMail, restoreDeletedOutgoingMail } from './restore.ts';

export {
  getIncomingMailRelations,
  getOutgoingMailRelations,
  createCrossMailRelation,
  createIncomingMailRelation,
  createOutgoingMailRelation,
  deleteMailRelation,
} from './relations.ts';

export { getMailFiles, getMailFileUrl, uploadMailFiles, deleteMailFile } from './attachments.ts';

export { updateOrganizationUserMailPermissions } from './permissions.ts';
