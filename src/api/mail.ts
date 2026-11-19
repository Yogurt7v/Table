/**
 * Публичный API почты: barrel-реэкспорт констант и функций из модулей `src/api/mail/*`.
 * Сохранён путь импорта `@/api/mail` и состав экспортов исходного монолита.
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
} from './mail/constants.ts';

export {
  getIncomingMails,
  getOutgoingMails,
  getAllIncomingMails,
  getIncomingMail,
  getAllOutgoingMails,
  getOutgoingMail,
} from './mail/registers.ts';

export { mergeCounterpartyVocabulary, getOrgCounterpartyVocabulary } from './mail/vocabulary.ts';

export type { CreateIncomingMailInput, CreateOutgoingMailInput } from './mail/mutations.ts';
export {
  createIncomingMail,
  createOutgoingMail,
  updateIncomingMail,
  updateOutgoingMail,
} from './mail/mutations.ts';

export type { CreateMailHistoryParams } from './mail/history.ts';
export {
  createMailHistory,
  getIncomingMailHistory,
  getOutgoingMailHistory,
  getDeletedIncomingMailHistory,
  getDeletedOutgoingMailHistory,
} from './mail/history.ts';

export {
  deleteIncomingMail,
  deleteOutgoingMail,
  getDeletedIncomingMails,
  getDeletedOutgoingMails,
  getDeletedIncomingMail,
  getDeletedOutgoingMail,
  getAllDeletedIncomingMails,
  getAllDeletedOutgoingMails,
} from './mail/archive.ts';

export { restoreDeletedIncomingMail, restoreDeletedOutgoingMail } from './mail/restore.ts';

export {
  getIncomingMailRelations,
  getOutgoingMailRelations,
  createCrossMailRelation,
  createIncomingMailRelation,
  createOutgoingMailRelation,
  deleteMailRelation,
} from './mail/relations.ts';

export {
  getMailFiles,
  getMailFileUrl,
  uploadMailFiles,
  deleteMailFile,
} from './mail/attachments.ts';

export { updateOrganizationUserMailPermissions } from './mail/permissions.ts';
