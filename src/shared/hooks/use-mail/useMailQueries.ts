/** Query-хуки почтовой корреспонденции: реестры, письма, файлы, история, связи и архив. */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getAllDeletedIncomingMails,
  getAllDeletedOutgoingMails,
  getAllIncomingMails,
  getAllOutgoingMails,
  getDeletedIncomingMails,
  getDeletedOutgoingMails,
  getIncomingMail,
  getIncomingMailHistory,
  getIncomingMails,
  getMailFiles,
  getOutgoingMail,
  getOutgoingMailHistory,
  getOutgoingMails,
} from '@/api/mail';
import type { MailType } from '@/shared/types';
import { RELATIONS_BY_TYPE } from './useMailShared';
import type { MailListQuery } from './useMailTypes';

// --- Реестры писем ---

/** Пагинированный список входящих писем организации. */
export function useIncomingMails(orgId: string, params: MailListQuery) {
  return useQuery({
    queryKey: ['incomingMails', orgId, params],
    queryFn: () => getIncomingMails({ ...params, organizationId: orgId }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  });
}

/** Пагинированный список исходящих писем организации. */
export function useOutgoingMails(orgId: string, params: MailListQuery) {
  return useQuery({
    queryKey: ['outgoingMails', orgId, params],
    queryFn: () => getOutgoingMails({ ...params, organizationId: orgId }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  });
}

/**
 * Полный список входящих писем для клиентского текстового поиска по всем полям.
 * Запрос отключается, пока поиск не активен (`enabled`), чтобы не грузить весь реестр на старте.
 */
export function useAllIncomingMails(orgId: string, params: MailListQuery, enabled = true) {
  return useQuery({
    queryKey: ['incomingMailsAll', orgId, params],
    queryFn: () => getAllIncomingMails({ ...params, organizationId: orgId }),
    enabled: !!orgId && enabled,
    placeholderData: keepPreviousData,
  });
}

/**
 * Полный список исходящих писем для клиентского текстового поиска по всем полям.
 * Запрос отключается, пока поиск не активен (`enabled`), чтобы не грузить весь реестр на старте.
 */
export function useAllOutgoingMails(orgId: string, params: MailListQuery, enabled = true) {
  return useQuery({
    queryKey: ['outgoingMailsAll', orgId, params],
    queryFn: () => getAllOutgoingMails({ ...params, organizationId: orgId }),
    enabled: !!orgId && enabled,
    placeholderData: keepPreviousData,
  });
}

// --- Конкретное письмо ---

/** Детали одного входящего письма. */
export function useIncomingMail(mailId: string) {
  return useQuery({
    queryKey: ['incomingMail', mailId],
    queryFn: () => getIncomingMail(mailId),
    enabled: !!mailId,
  });
}

/** Детали одного исходящего письма. */
export function useOutgoingMail(mailId: string) {
  return useQuery({
    queryKey: ['outgoingMail', mailId],
    queryFn: () => getOutgoingMail(mailId),
    enabled: !!mailId,
  });
}

// --- Вложения, история и связи письма ---

/** Список вложений письма. */
export function useMailFiles(mailId: string, mailType: MailType) {
  return useQuery({
    queryKey: ['mailFiles', mailId, mailType],
    queryFn: () => getMailFiles(mailId, mailType),
    enabled: !!mailId,
  });
}

/** История изменений входящего письма. */
export function useIncomingMailHistory(mailId: string) {
  return useQuery({
    queryKey: ['incomingMailHistory', mailId],
    queryFn: () => getIncomingMailHistory(mailId),
    enabled: !!mailId,
  });
}

/** История изменений исходящего письма. */
export function useOutgoingMailHistory(mailId: string) {
  return useQuery({
    queryKey: ['outgoingMailHistory', mailId],
    queryFn: () => getOutgoingMailHistory(mailId),
    enabled: !!mailId,
  });
}

/** Связи письма с другими письмами (в обе стороны, родитель/потомок). */
export function useMailRelations(mailId: string, mailType: MailType) {
  return useQuery({
    queryKey: ['mailRelations', mailId, mailType],
    queryFn: () => RELATIONS_BY_TYPE[mailType](mailId),
    enabled: !!mailId,
  });
}

// --- Архив удалённых писем ---

/** Пагинированный список удалённых входящих писем. */
export function useDeletedIncomingMails(orgId: string, params: MailListQuery) {
  return useQuery({
    queryKey: ['deletedIncomingMails', orgId, params],
    queryFn: () => getDeletedIncomingMails({ ...params, organizationId: orgId }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  });
}

/** Пагинированный список удалённых исходящих писем. */
export function useDeletedOutgoingMails(orgId: string, params: MailListQuery) {
  return useQuery({
    queryKey: ['deletedOutgoingMails', orgId, params],
    queryFn: () => getDeletedOutgoingMails({ ...params, organizationId: orgId }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  });
}

/** Полный список удалённых входящих писем (например, для поисковых/служебных сценариев). */
export function useAllDeletedIncomingMails(orgId: string, enabled = true) {
  return useQuery({
    queryKey: ['deletedIncomingMails-all', orgId],
    queryFn: () => getAllDeletedIncomingMails(orgId),
    enabled: !!orgId && enabled,
  });
}

/** Полный список удалённых исходящих писем (например, для поисковых/служебных сценариев). */
export function useAllDeletedOutgoingMails(orgId: string, enabled = true) {
  return useQuery({
    queryKey: ['deletedOutgoingMails-all', orgId],
    queryFn: () => getAllDeletedOutgoingMails(orgId),
    enabled: !!orgId && enabled,
  });
}
