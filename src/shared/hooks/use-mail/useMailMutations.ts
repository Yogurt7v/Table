/** Mutation-хуки почтовой корреспонденции: создание, изменение, удаление, восстановление, вложения и связи. */

import {
  createIncomingMail,
  createOutgoingMail,
  deleteIncomingMail,
  deleteMailFile,
  deleteMailRelation,
  deleteOutgoingMail,
  restoreDeletedIncomingMail,
  restoreDeletedOutgoingMail,
  updateIncomingMail,
  updateOutgoingMail,
  uploadMailFiles,
  type CreateIncomingMailInput,
  type CreateOutgoingMailInput,
} from '@/api/mail';
import type { IIncomingMail, IMailFile, IMailRelation, IOutgoingMail } from '@/shared/types';
import {
  CREATE_RELATION_BY_TYPE,
  MAIL_KEY_BY_TYPE,
  invalidateMail,
  useMailMutation,
} from './useMailShared';
import type {
  CreateMailRelationVars,
  DeleteMailRelationVars,
  DeleteMailVars,
  UpdateIncomingMailVars,
  UpdateOutgoingMailVars,
  UploadMailFilesVars,
} from './useMailTypes';

// --- Создание писем ---

/** Создаёт входящее письмо и инвалидирует реестр входящих. */
export function useCreateIncomingMail(orgId: string) {
  return useMailMutation<CreateIncomingMailInput, IIncomingMail>(
    (data) => createIncomingMail(data),
    'Не удалось создать входящее письмо',
    (queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['incomingMails', orgId] });
    },
  );
}

/** Создаёт исходящее письмо и инвалидирует реестр исходящих. */
export function useCreateOutgoingMail(orgId: string) {
  return useMailMutation<CreateOutgoingMailInput, IOutgoingMail>(
    (data) => createOutgoingMail(data),
    'Не удалось создать исходящее письмо',
    (queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['outgoingMails', orgId] });
    },
  );
}

// --- Обновление писем ---

/** Обновляет входящее письмо, сохраняет историю и инвалидирует реестр/детали/связи. */
export function useUpdateIncomingMail(orgId: string) {
  return useMailMutation<UpdateIncomingMailVars, IIncomingMail>(
    ({ id, data, previousData }) => updateIncomingMail(id, data, previousData),
    'Не удалось сохранить входящее письмо',
    (queryClient, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['incomingMails', orgId] });
      invalidateMail(queryClient, 'incoming', id);
    },
  );
}

/** Обновляет исходящее письмо, сохраняет историю и инвалидирует реестр/детали/связи. */
export function useUpdateOutgoingMail(orgId: string) {
  return useMailMutation<UpdateOutgoingMailVars, IOutgoingMail>(
    ({ id, data, previousData }) => updateOutgoingMail(id, data, previousData),
    'Не удалось сохранить исходящее письмо',
    (queryClient, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['outgoingMails', orgId] });
      invalidateMail(queryClient, 'outgoing', id);
    },
  );
}

// --- Удаление писем (архивирование) ---

/**
 * Архивирует входящее письмо на сервере: обновляет реестр и архив, инвалидирует детали/историю/связи.
 * Причина удаления обязательна и передаётся вызывающим кодом.
 */
export function useDeleteIncomingMail(orgId: string) {
  return useMailMutation<DeleteMailVars, boolean>(
    ({ id, reason }) => deleteIncomingMail(id, reason),
    'Не удалось удалить входящее письмо',
    (queryClient, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['incomingMails', orgId] });
      queryClient.invalidateQueries({ queryKey: ['deletedIncomingMails', orgId] });
      invalidateMail(queryClient, 'incoming', id);
    },
  );
}

/**
 * Архивирует исходящее письмо на сервере: обновляет реестр и архив, инвалидирует детали/историю/связи.
 * Причина удаления обязательна и передаётся вызывающим кодом.
 */
export function useDeleteOutgoingMail(orgId: string) {
  return useMailMutation<DeleteMailVars, boolean>(
    ({ id, reason }) => deleteOutgoingMail(id, reason),
    'Не удалось удалить исходящее письмо',
    (queryClient, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['outgoingMails', orgId] });
      queryClient.invalidateQueries({ queryKey: ['deletedOutgoingMails', orgId] });
      invalidateMail(queryClient, 'outgoing', id);
    },
  );
}

// --- Восстановление писем ---

/**
 * Восстанавливает входящее письмо из архива под исходным id (неизвестен из id архивной записи),
 * поэтому инвалидируется вся история входящих писем.
 */
export function useRestoreDeletedIncomingMail(orgId: string) {
  return useMailMutation<string, IIncomingMail>(
    (deletedMailId) => restoreDeletedIncomingMail(deletedMailId),
    'Не удалось восстановить входящее письмо',
    (queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['deletedIncomingMails', orgId] });
      queryClient.invalidateQueries({ queryKey: ['incomingMails', orgId] });
      queryClient.invalidateQueries({ queryKey: ['incomingMailHistory'] });
    },
  );
}

/**
 * Восстанавливает исходящее письмо из архива под исходным id (неизвестен из id архивной записи),
 * поэтому инвалидируется вся история исходящих писем.
 */
export function useRestoreDeletedOutgoingMail(orgId: string) {
  return useMailMutation<string, IOutgoingMail>(
    (deletedMailId) => restoreDeletedOutgoingMail(deletedMailId),
    'Не удалось восстановить исходящее письмо',
    (queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['deletedOutgoingMails', orgId] });
      queryClient.invalidateQueries({ queryKey: ['outgoingMails', orgId] });
      queryClient.invalidateQueries({ queryKey: ['outgoingMailHistory'] });
    },
  );
}

// --- Вложения ---

/** Загружает вложения письма; инвалидирует файлы и оба реестра (фильтр `withFiles` применяется клиентски). */
export function useUploadMailFiles(orgId: string) {
  return useMailMutation<UploadMailFilesVars, IMailFile[]>(
    ({ mailId, mailType, files }) => uploadMailFiles(mailId, mailType, orgId, files),
    'Не удалось загрузить вложения',
    (queryClient, { mailId, mailType }) => {
      queryClient.invalidateQueries({ queryKey: ['mailFiles', mailId, mailType] });
      queryClient.invalidateQueries({ queryKey: ['incomingMails', orgId] });
      queryClient.invalidateQueries({ queryKey: ['outgoingMails', orgId] });
    },
  );
}

/** Удаляет вложение письма; инвалидирует файлы и оба реестра. */
export function useDeleteMailFile(orgId: string) {
  return useMailMutation<IMailFile, boolean>(
    (file) => deleteMailFile(file.id),
    'Не удалось удалить вложение',
    (queryClient, file) => {
      queryClient.invalidateQueries({ queryKey: ['mailFiles', file.mail_id, file.mail_type] });
      queryClient.invalidateQueries({ queryKey: ['incomingMails', orgId] });
      queryClient.invalidateQueries({ queryKey: ['outgoingMails', orgId] });
    },
  );
}

// --- Связи писем ---

/** Создаёт связь между письмами; инвалидирует связи и историю обоих концов. */
export function useCreateMailRelation(orgId: string) {
  return useMailMutation<CreateMailRelationVars, IMailRelation>(
    ({ parentId, childId, mailType }) =>
      CREATE_RELATION_BY_TYPE[mailType](parentId, childId, orgId),
    'Не удалось связать письма',
    (queryClient, { parentId, childId, mailType }) => {
      queryClient.invalidateQueries({ queryKey: ['mailRelations', parentId, mailType] });
      queryClient.invalidateQueries({ queryKey: ['mailRelations', childId, mailType] });
      queryClient.invalidateQueries({ queryKey: [MAIL_KEY_BY_TYPE[mailType].history] });
    },
  );
}

/** Удаляет связь писем; концы связи известны только API, поэтому инвалидируются все связи/история типа. */
export function useDeleteMailRelation(orgId: string) {
  return useMailMutation<DeleteMailRelationVars, void>(
    ({ relationId }) => deleteMailRelation(relationId, orgId),
    'Не удалось удалить связь',
    (queryClient, { mailType }) => {
      queryClient.invalidateQueries({ queryKey: ['mailRelations'] });
      queryClient.invalidateQueries({ queryKey: [MAIL_KEY_BY_TYPE[mailType].history] });
    },
  );
}
