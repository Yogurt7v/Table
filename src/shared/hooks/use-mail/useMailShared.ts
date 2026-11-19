/**
 * Внутренние константы и утилиты хуков почты.
 *
 * Ключи кэша (зеркалятся в инвалидациях):
 *   ['incomingMails', orgId, params]        ['incomingMail', mailId]
 *   ['outgoingMails', orgId, params]        ['outgoingMail', mailId]
 *   ['deletedIncomingMails', orgId, params] ['incomingMailHistory', mailId]
 *   ['deletedOutgoingMails', orgId, params] ['outgoingMailHistory', mailId]
 *                                          ['mailFiles', mailId, mailType]
 *                                          ['mailRelations', mailId, mailType]
 *
 * Реестры ключуются по `orgId`, поэтому организации не делят кэш. Per-mail ключи
 * используют только id записи (уникален в PocketBase); инвалидации реестров передают
 * префикс из двух элементов и полагаются на частичное совпадение ключей TanStack Query.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  createIncomingMailRelation,
  createOutgoingMailRelation,
  getIncomingMailRelations,
  getOutgoingMailRelations,
} from '@/api/mail';
import type { IMailRelation, MailType } from '@/shared/types';

/** Префиксы per-mail ключей кэша по типу реестра. */
export const MAIL_KEY_BY_TYPE: Record<MailType, { detail: string; history: string }> = {
  incoming: { detail: 'incomingMail', history: 'incomingMailHistory' },
  outgoing: { detail: 'outgoingMail', history: 'outgoingMailHistory' },
};

/** Получение связей письма по типу реестра. */
export const RELATIONS_BY_TYPE: Record<MailType, (mailId: string) => Promise<IMailRelation[]>> = {
  incoming: getIncomingMailRelations,
  outgoing: getOutgoingMailRelations,
};

/** Создание связи письма по типу реестра. */
export const CREATE_RELATION_BY_TYPE: Record<
  MailType,
  (parentId: string, childId: string, organizationId: string) => Promise<IMailRelation>
> = {
  incoming: createIncomingMailRelation,
  outgoing: createOutgoingMailRelation,
};

/** Инвалидирует кэш карточки письма: детали, историю и связи. */
export function invalidateMail(queryClient: QueryClient, mailType: MailType, mailId: string) {
  const keys = MAIL_KEY_BY_TYPE[mailType];
  queryClient.invalidateQueries({ queryKey: [keys.detail, mailId] });
  queryClient.invalidateQueries({ queryKey: [keys.history, mailId] });
  queryClient.invalidateQueries({ queryKey: ['mailRelations', mailId, mailType] });
}

/**
 * Общий контракт почтовых мутаций: toast об ошибке и инвалидация кэша в `onSettled`
 * (включая успешный исход), чтобы затронутые данные всегда обновлялись.
 */
export function useMailMutation<TVars, TData>(
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
