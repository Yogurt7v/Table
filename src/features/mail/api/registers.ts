/** Чтение живых реестров писем (входящие/исходящие), с пагинацией и без. */

import type { ListResult } from 'pocketbase';
import { pb } from '@/api/client';
import type { IIncomingMail, IOutgoingMail, MailListParams } from '@/shared/types';
import {
  LIVE_MAIL_SORT,
  MAIL_INCOMING_COLLECTION,
  MAIL_OUTGOING_COLLECTION,
  MAIL_PAGE_SIZE,
} from './constants.ts';
import {
  applyClientOnlyMailFlags,
  buildIncomingMailFilter,
  buildOutgoingMailFilter,
} from './filters.ts';

/** Paginated incoming mail register for one organization, newest first. */
export function getIncomingMails(params: MailListParams): Promise<ListResult<IIncomingMail>> {
  return pb
    .collection(MAIL_INCOMING_COLLECTION)
    .getList<IIncomingMail>(params.page ?? 1, params.perPage ?? MAIL_PAGE_SIZE, {
      filter: buildIncomingMailFilter(params),
      sort: params.sort ?? LIVE_MAIL_SORT,
    })
    .then((page) => applyClientOnlyMailFlags(page, params, 'incoming'));
}

/** Paginated outgoing mail register for one organization, newest first. */
export function getOutgoingMails(params: MailListParams): Promise<ListResult<IOutgoingMail>> {
  return pb
    .collection(MAIL_OUTGOING_COLLECTION)
    .getList<IOutgoingMail>(params.page ?? 1, params.perPage ?? MAIL_PAGE_SIZE, {
      filter: buildOutgoingMailFilter(params),
      sort: params.sort ?? LIVE_MAIL_SORT,
    })
    .then((page) => applyClientOnlyMailFlags(page, params, 'outgoing'));
}

/**
 * Полный список входящих писем для клиентского поиска — без пагинации и без
 * текстового фильтра. Текстовый поиск выполняется на клиенте через
 * `matchesFolded`, потому что серверный `LIKE` сворачивает регистр только для
 * ASCII, и кириллица ищется регистрозависимо.
 */
export function getAllIncomingMails(params: MailListParams): Promise<IIncomingMail[]> {
  const filterParams = { ...params };
  delete filterParams.search;
  delete filterParams.page;
  delete filterParams.perPage;

  return pb
    .collection(MAIL_INCOMING_COLLECTION)
    .getFullList<IIncomingMail>({
      filter: buildIncomingMailFilter(filterParams),
      sort: filterParams.sort ?? LIVE_MAIL_SORT,
    })
    .then((items) => {
      const page: ListResult<IIncomingMail> = {
        page: 1,
        perPage: items.length,
        totalItems: items.length,
        totalPages: items.length === 0 ? 0 : 1,
        items,
      };
      return applyClientOnlyMailFlags(page, filterParams, 'incoming');
    })
    .then((result) => result.items);
}

/** Одно входящее письмо по идентификатору. */
export function getIncomingMail(id: string) {
  return pb.collection(MAIL_INCOMING_COLLECTION).getOne<IIncomingMail>(id);
}

/** Полный список исходящих писем для клиентского поиска (без пагинации). */
export function getAllOutgoingMails(params: MailListParams): Promise<IOutgoingMail[]> {
  const filterParams = { ...params };
  delete filterParams.search;
  delete filterParams.page;
  delete filterParams.perPage;

  return pb
    .collection(MAIL_OUTGOING_COLLECTION)
    .getFullList<IOutgoingMail>({
      filter: buildOutgoingMailFilter(filterParams),
      sort: filterParams.sort ?? LIVE_MAIL_SORT,
    })
    .then((items) => {
      const page: ListResult<IOutgoingMail> = {
        page: 1,
        perPage: items.length,
        totalItems: items.length,
        totalPages: items.length === 0 ? 0 : 1,
        items,
      };
      return applyClientOnlyMailFlags(page, filterParams, 'outgoing');
    })
    .then((result) => result.items);
}

/** Одно исходящее письмо по идентификатору. */
export function getOutgoingMail(id: string) {
  return pb.collection(MAIL_OUTGOING_COLLECTION).getOne<IOutgoingMail>(id);
}
