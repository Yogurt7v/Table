import type { MailListQuery } from '@/shared/hooks/useMail';
import { LIVE_MAIL_SORT_ASC } from '@/api/mail';
import { dateKeyToBound, resolvePeriodBounds } from '../../model/mail-date';
import type { MailFilterState } from './mail-filter-types';

/**
 * `MailListQuery` для `useIncomingMails`/`useOutgoingMails`. Пустые значения
 * не попадают в объект вообще: лишний `counterparty: ''` изменил бы ключ
 * React Query и заставил бы рефетчить тот же запрос.
 */
export function buildMailListQuery(state: MailFilterState): MailListQuery {
  const { dateFrom, dateTo } = resolvePeriodBounds(state.period, state.customFrom, state.customTo);
  const counterparty = state.counterparty.trim();

  const query: MailListQuery = {
    ...(state.search.trim() ? { search: state.search.trim() } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(state.accountingObjectIds.length > 0
      ? { accountingObjectIds: state.accountingObjectIds }
      : {}),
    ...(state.withoutAccountingObject ? { withoutAccountingObject: true } : {}),
    ...(state.deliveryMethods.length > 0 ? { deliveryMethods: state.deliveryMethods } : {}),
    ...(state.withoutDeliveryMethod ? { withoutDeliveryMethod: true } : {}),
    ...(state.responsibleIds.length > 0 ? { responsibleIds: state.responsibleIds } : {}),
    ...(counterparty ? { counterparty } : {}),
    // `sort` уходит только для обратного направления: убывающий порядок —
    // умолчание сервера (`params.sort ?? LIVE_MAIL_SORT`), и лишний `sort` в
    // запросе изменил бы ключ React Query, не изменив выдачу. Значение берётся
    // из константы API, в строку оно не интерполируется.
    ...(state.sortDirection === 'asc' ? { sort: LIVE_MAIL_SORT_ASC } : {}),
  };

  return query;
}

/** Границы периода для архива: тот же резолвер, но для удалённых писем. */
export function archivePeriodBounds(state: MailFilterState): {
  dateFrom?: string;
  dateTo?: string;
} {
  const { dateFrom, dateTo } = resolvePeriodBounds(state.period, state.customFrom, state.customTo);
  return { dateFrom: dateKeyToBound(dateFrom), dateTo: dateKeyToBound(dateTo) };
}
