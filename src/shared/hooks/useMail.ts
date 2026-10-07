import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  createIncomingMail,
  createIncomingMailRelation,
  createOutgoingMail,
  createOutgoingMailRelation,
  deleteIncomingMail,
  deleteMailFile,
  deleteMailRelation,
  deleteOutgoingMail,
  getDeletedIncomingMails,
  getDeletedOutgoingMails,
  getIncomingMail,
  getIncomingMailHistory,
  getIncomingMailRelations,
  getIncomingMails,
  getMailFiles,
  getOutgoingMail,
  getOutgoingMailHistory,
  getOutgoingMailRelations,
  getOutgoingMails,
  restoreDeletedIncomingMail,
  restoreDeletedOutgoingMail,
  updateIncomingMail,
  updateOutgoingMail,
  uploadMailFiles,
  type CreateIncomingMailInput,
  type CreateOutgoingMailInput,
} from '@/api/mail';
import type {
  IIncomingMail,
  IMailFile,
  IMailRelation,
  IOutgoingMail,
  MailListParams,
  MailType,
} from '@/shared/types';

/**
 * Query/mutation hooks over `src/api/mail.ts`.
 *
 * Cache keys, mirrored by every `invalidateQueries` below:
 *
 *   ['incomingMails', orgId, params]        ['incomingMail', mailId]
 *   ['outgoingMails', orgId, params]        ['outgoingMail', mailId]
 *   ['deletedIncomingMails', orgId, params] ['incomingMailHistory', mailId]
 *   ['deletedOutgoingMails', orgId, params] ['outgoingMailHistory', mailId]
 *                                          ['mailFiles', mailId, mailType]
 *                                          ['mailRelations', mailId, mailType]
 *
 * Registers carry `orgId`, so two organizations can never share an entry. The
 * per-mail keys key on the record id alone: a PocketBase id is unique across all
 * collections, so it already separates two organizations, and the per-mail
 * signatures never receive an `orgId` to put in the key. Register invalidations
 * pass the two-element prefix and lean on TanStack's partial key match, so every
 * filter variant of a register refetches at once.
 */

export type MailListQuery = Omit<MailListParams, 'organizationId'>;

/** Per-mail key prefixes by register — the exhaustive form of a `mailType` switch. */
const MAIL_KEY_BY_TYPE: Record<MailType, { detail: string; history: string }> = {
  incoming: { detail: 'incomingMail', history: 'incomingMailHistory' },
  outgoing: { detail: 'outgoingMail', history: 'outgoingMailHistory' },
};

const RELATIONS_BY_TYPE: Record<MailType, (mailId: string) => Promise<IMailRelation[]>> = {
  incoming: getIncomingMailRelations,
  outgoing: getOutgoingMailRelations,
};

const CREATE_RELATION_BY_TYPE: Record<
  MailType,
  (parentId: string, childId: string, organizationId: string) => Promise<IMailRelation>
> = {
  incoming: createIncomingMailRelation,
  outgoing: createOutgoingMailRelation,
};

/** Everything keyed on one letter: its page, its audit trail and its links. */
function invalidateMail(queryClient: QueryClient, mailType: MailType, mailId: string) {
  const keys = MAIL_KEY_BY_TYPE[mailType];
  queryClient.invalidateQueries({ queryKey: [keys.detail, mailId] });
  queryClient.invalidateQueries({ queryKey: [keys.history, mailId] });
  queryClient.invalidateQueries({ queryKey: ['mailRelations', mailId, mailType] });
}

/**
 * The mail mutation contract in one place: a red Russian toast on failure, plus
 * an invalidation on settle — which also runs after a success, so no mutation
 * can forget to refetch what it touched.
 */
function useMailMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  errorMessage: string,
  invalidate: (queryClient: QueryClient, vars: TVars) => void,
) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn,
    onError: () => notifications.show({ color: 'red', message: errorMessage }),
    onSettled: (_data, _error, vars) => invalidate(queryClient, vars),
  });
}

// --- Registers ---

export function useIncomingMails(orgId: string, params: MailListQuery) {
  return useQuery({
    queryKey: ['incomingMails', orgId, params],
    queryFn: () => getIncomingMails({ ...params, organizationId: orgId }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  });
}

export function useOutgoingMails(orgId: string, params: MailListQuery) {
  return useQuery({
    queryKey: ['outgoingMails', orgId, params],
    queryFn: () => getOutgoingMails({ ...params, organizationId: orgId }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  });
}

export function useIncomingMail(mailId: string) {
  return useQuery({
    queryKey: ['incomingMail', mailId],
    queryFn: () => getIncomingMail(mailId),
    enabled: !!mailId,
  });
}

export function useOutgoingMail(mailId: string) {
  return useQuery({
    queryKey: ['outgoingMail', mailId],
    queryFn: () => getOutgoingMail(mailId),
    enabled: !!mailId,
  });
}

export function useMailFiles(mailId: string, mailType: MailType) {
  return useQuery({
    queryKey: ['mailFiles', mailId, mailType],
    queryFn: () => getMailFiles(mailId, mailType),
    enabled: !!mailId,
  });
}

export function useIncomingMailHistory(mailId: string) {
  return useQuery({
    queryKey: ['incomingMailHistory', mailId],
    queryFn: () => getIncomingMailHistory(mailId),
    enabled: !!mailId,
  });
}

export function useOutgoingMailHistory(mailId: string) {
  return useQuery({
    queryKey: ['outgoingMailHistory', mailId],
    queryFn: () => getOutgoingMailHistory(mailId),
    enabled: !!mailId,
  });
}

/** Both directions of a link, parent or child side, for one letter. */
export function useMailRelations(mailId: string, mailType: MailType) {
  return useQuery({
    queryKey: ['mailRelations', mailId, mailType],
    queryFn: () => RELATIONS_BY_TYPE[mailType](mailId),
    enabled: !!mailId,
  });
}

export function useDeletedIncomingMails(orgId: string, params: MailListQuery) {
  return useQuery({
    queryKey: ['deletedIncomingMails', orgId, params],
    queryFn: () => getDeletedIncomingMails({ ...params, organizationId: orgId }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  });
}

export function useDeletedOutgoingMails(orgId: string, params: MailListQuery) {
  return useQuery({
    queryKey: ['deletedOutgoingMails', orgId, params],
    queryFn: () => getDeletedOutgoingMails({ ...params, organizationId: orgId }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  });
}

// --- Mutations ---

export function useCreateIncomingMail(orgId: string) {
  return useMailMutation<CreateIncomingMailInput, IIncomingMail>(
    (data) => createIncomingMail(data),
    'Не удалось создать входящее письмо',
    (queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['incomingMails', orgId] });
    },
  );
}

export function useCreateOutgoingMail(orgId: string) {
  return useMailMutation<CreateOutgoingMailInput, IOutgoingMail>(
    (data) => createOutgoingMail(data),
    'Не удалось создать исходящее письмо',
    (queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['outgoingMails', orgId] });
    },
  );
}

export type UpdateIncomingMailVars = {
  id: string;
  data: Partial<IIncomingMail>;
  /** Snapshotted into `mail_history` by the API layer before the update lands. */
  previousData: Record<string, unknown>;
};

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

export type UpdateOutgoingMailVars = {
  id: string;
  data: Partial<IOutgoingMail>;
  previousData: Record<string, unknown>;
};

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

/**
 * Delete archives the letter server-side, so the register and the archive list
 * both move; history and relations cascade-delete with it, which is exactly what
 * these invalidations drop.
 */
export function useDeleteIncomingMail(orgId: string) {
  return useMailMutation<string, boolean>(
    (id) => deleteIncomingMail(id),
    'Не удалось удалить входящее письмо',
    (queryClient, id) => {
      queryClient.invalidateQueries({ queryKey: ['incomingMails', orgId] });
      queryClient.invalidateQueries({ queryKey: ['deletedIncomingMails', orgId] });
      invalidateMail(queryClient, 'incoming', id);
    },
  );
}

export function useDeleteOutgoingMail(orgId: string) {
  return useMailMutation<string, boolean>(
    (id) => deleteOutgoingMail(id),
    'Не удалось удалить исходящее письмо',
    (queryClient, id) => {
      queryClient.invalidateQueries({ queryKey: ['outgoingMails', orgId] });
      queryClient.invalidateQueries({ queryKey: ['deletedOutgoingMails', orgId] });
      invalidateMail(queryClient, 'outgoing', id);
    },
  );
}

/**
 * Restore re-creates the letter under its original id, which the archive row id
 * does not reveal — so the letter's own history key cannot be named here and the
 * whole register's history is refetched instead.
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

export type UploadMailFilesVars = {
  mailId: string;
  mailType: MailType;
  files: File[];
};

/** Both registers are refetched: `withFiles` narrows a fetched page client-side. */
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

export type CreateMailRelationVars = {
  parentId: string;
  childId: string;
  mailType: MailType;
};

/** One `linked` history entry lands on each of the two letters. */
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

export type DeleteMailRelationVars = {
  relationId: string;
  mailType: MailType;
};

/** The two ends are only known inside the API call, so every letter refetches. */
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
