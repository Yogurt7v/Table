import { useCallback, useMemo, useState } from 'react';
import type { DeliveryMethod, MailType } from '@/shared/types';
import type { MailListQuery } from '@/shared/hooks/useMail';
import {
  MAIL_ATTACHMENT_FILTER_LABELS,
  MAIL_COUNTERPARTY_FIELD_LABELS,
  MAIL_NO_ACCOUNTING_OBJECT_LABEL,
  MAIL_NO_DELIVERY_METHOD_LABEL,
  MAIL_PERIOD_PRESET_LABELS,
} from './mail-labels';
import { dateKeyToBound, formatPeriodBounds, resolvePeriodBounds } from './mail-date';
import type { MailPeriodPreset } from './mail-date';

/**
 * Единственное состояние фильтров почты. Всё, что `src/api/mail.ts` умеет
 * отбирать на сервере, уезжает в `params`; `search` уезжает в `params` тоже,
 * но серверный поиск не выполняется — текстовый поиск письма делает
 * `MailSection` через `matchesFolded` по уже загруженному списку.
 *
 * Исключения — отбор по вложениям и по связанным письмам: у них нет обратной
 * ссылки с письма на вложение, поэтому отбор идёт в обратную сторону и
 * пересекается с уже загруженной страницей, а не с набором фильтров. Оба
 * отбора применяются к загруженной странице в `MailSection` — тем же
 * способом, каким реестр счетов считает `filesByInvoice`. Точный отбор по
 * всей организации потребовал бы пагинации списка целиком, о чём прямо
 * предупреждает докстрока `applyClientOnlyMailFlags`.
 */

/** Отбор по вложениям: одно из трёх взаимоисключающих состояний. */
export type MailAttachmentFilter = keyof typeof MAIL_ATTACHMENT_FILTER_LABELS;

export type MailFilterGroup =
  | 'period'
  | 'accountingObject'
  | 'deliveryMethod'
  | 'responsible'
  | 'counterparty'
  | 'attachments'
  | 'relations';

export interface MailFilterState {
  period: MailPeriodPreset;
  customFrom: string;
  customTo: string;
  accountingObjectIds: string[];
  withoutAccountingObject: boolean;
  deliveryMethods: DeliveryMethod[];
  withoutDeliveryMethod: boolean;
  responsibleIds: string[];
  counterparty: string;
  attachments: MailAttachmentFilter;
  hasRelations: boolean;
  search: string;
}

export const DEFAULT_MAIL_FILTERS: MailFilterState = {
  period: 'all',
  customFrom: '',
  customTo: '',
  accountingObjectIds: [],
  withoutAccountingObject: false,
  deliveryMethods: [],
  withoutDeliveryMethod: false,
  responsibleIds: [],
  counterparty: '',
  attachments: 'any',
  hasRelations: false,
  search: '',
};

export const MAIL_FILTER_GROUPS: MailFilterGroup[] = [
  'period',
  'accountingObject',
  'deliveryMethod',
  'responsible',
  'counterparty',
  'attachments',
  'relations',
];

export function createDefaultMailFilters(): MailFilterState {
  return { ...DEFAULT_MAIL_FILTERS };
}

/** Группы, в которых что-то выбрано — ими питается подпись `Фильтр (N)`. */
export function activeFilterGroups(state: MailFilterState): MailFilterGroup[] {
  const active: MailFilterGroup[] = [];

  if (state.period !== 'all' && state.period !== 'custom') active.push('period');
  if (state.period === 'custom' && (state.customFrom || state.customTo)) active.push('period');
  if (state.accountingObjectIds.length > 0 || state.withoutAccountingObject) {
    active.push('accountingObject');
  }
  if (state.deliveryMethods.length > 0 || state.withoutDeliveryMethod)
    active.push('deliveryMethod');
  if (state.responsibleIds.length > 0) active.push('responsible');
  if (state.counterparty.trim().length > 0) active.push('counterparty');
  if (state.attachments !== 'any') active.push('attachments');
  if (state.hasRelations) active.push('relations');

  return active;
}

export function hasActiveFilters(state: MailFilterState): boolean {
  return activeFilterGroups(state).length > 0;
}

/** Снимает одну группу, не трогая остальные. */
export function resetFilterGroup(state: MailFilterState, group: MailFilterGroup): MailFilterState {
  switch (group) {
    case 'period':
      return { ...state, period: 'all', customFrom: '', customTo: '' };
    case 'accountingObject':
      return { ...state, accountingObjectIds: [], withoutAccountingObject: false };
    case 'deliveryMethod':
      return { ...state, deliveryMethods: [], withoutDeliveryMethod: false };
    case 'responsible':
      return { ...state, responsibleIds: [] };
    case 'counterparty':
      return { ...state, counterparty: '' };
    case 'attachments':
      return { ...state, attachments: 'any' };
    case 'relations':
      return { ...state, hasRelations: false };
  }
}

/** Отбор по вложениям — одно из трёх, поэтому «есть» и «без» не могут coexist. */
export function cycleAttachmentFilter(current: MailAttachmentFilter): MailAttachmentFilter {
  switch (current) {
    case 'any':
      return 'with';
    case 'with':
      return 'without';
    case 'without':
    default:
      return 'any';
  }
}

export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

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
  };

  return query;
}

export interface MailFilterChip {
  group: MailFilterGroup;
  label: string;
  /** Ключ снятия: id объекта/ответственного, значение `DeliveryMethod`, `''` — для переключателей. */
  value: string;
}

/** Подписи для resolver-ов названий: id объекта → имя, id пользователя → имя. */
export interface MailFilterChipContext {
  mailType: MailType;
  objectNames: Map<string, string>;
  responsibleNames: Map<string, string>;
  deliveryLabels: Record<DeliveryMethod, string>;
}

/**
 * Разворачивает состояние в список чипов активных фильтров — по одному на
 * ВЫБРАННОЕ значение, а не на группу: пять объектов учёта это пять чипов, и
 * каждый снимается отдельно (пункт 8 набора фильтров).
 */
export function buildFilterChips(
  state: MailFilterState,
  context: MailFilterChipContext,
): MailFilterChip[] {
  const chips: MailFilterChip[] = [];

  // if (state.period !== 'all' && state.period !== 'custom') {
  //   chips.push({
  //     group: 'period',
  //     label: `${MAIL_PERIOD_PRESET_LABELS[state.period]}`,
  //     value: state.period,
  //   });
  // }
  if (state.period === 'custom') {
    const periodText = formatPeriodBounds(state.period, state.customFrom, state.customTo);
    if (periodText) chips.push({ group: 'period', label: periodText, value: 'custom' });
  }

  for (const id of state.accountingObjectIds) {
    chips.push({
      group: 'accountingObject',
      label: context.objectNames.get(id) ?? id,
      value: id,
    });
  }
  if (state.withoutAccountingObject) {
    chips.push({
      group: 'accountingObject',
      label: MAIL_NO_ACCOUNTING_OBJECT_LABEL,
      value: WITHOUT_OBJECT_VALUE,
    });
  }

  for (const method of state.deliveryMethods) {
    chips.push({
      group: 'deliveryMethod',
      label: context.deliveryLabels[method],
      value: method,
    });
  }
  if (state.withoutDeliveryMethod) {
    chips.push({
      group: 'deliveryMethod',
      label: MAIL_NO_DELIVERY_METHOD_LABEL,
      value: WITHOUT_METHOD_VALUE,
    });
  }

  for (const id of state.responsibleIds) {
    chips.push({
      group: 'responsible',
      label: context.responsibleNames.get(id) ?? id,
      value: id,
    });
  }

  if (state.counterparty.trim()) {
    chips.push({
      group: 'counterparty',
      label: `${MAIL_COUNTERPARTY_FIELD_LABELS[context.mailType]}: ${state.counterparty.trim()}`,
      value: state.counterparty.trim(),
    });
  }

  if (state.attachments !== 'any') {
    chips.push({
      group: 'attachments',
      label: MAIL_ATTACHMENT_FILTER_LABELS[state.attachments],
      value: state.attachments,
    });
  }

  if (state.hasRelations) {
    chips.push({ group: 'relations', label: 'Есть связанные', value: 'relations' });
  }

  return chips;
}

/** Значения `MailFilterChip.value`, зарезервированные под переключатели. */
const WITHOUT_OBJECT_VALUE = '__without_object__';
const WITHOUT_METHOD_VALUE = '__without_delivery__';

export interface UseMailFiltersResult {
  filters: MailFilterState;
  /** Готовый `MailListQuery`; стабильная ссылка между рендерами. */
  query: MailListQuery;
  activeGroups: MailFilterGroup[];
  activeCount: number;
  hasSearch: boolean;
  setSearch: (value: string) => void;
  setPeriod: (preset: MailPeriodPreset) => void;
  setCustomRange: (from: string, to: string) => void;
  toggleAccountingObject: (id: string) => void;
  toggleWithoutAccountingObject: () => void;
  toggleDeliveryMethod: (method: DeliveryMethod) => void;
  toggleWithoutDeliveryMethod: () => void;
  toggleResponsible: (id: string) => void;
  setCounterparty: (value: string) => void;
  cycleAttachments: () => void;
  setAttachments: (value: MailAttachmentFilter) => void;
  toggleHasRelations: () => void;
  removeChip: (chip: MailFilterChip) => void;
  resetGroup: (group: MailFilterGroup) => void;
  resetAll: () => void;
}

/**
 * Состояние фильтров одного реестра. `MailSection` держит по одному такому
 * хуку на вкладку: у входящих и исходящих писем разные поля «контрагент» и
 * номера, а общий поиск живёт выше и передаётся в оба.
 */
export function useMailFilters(initial?: Partial<MailFilterState>): UseMailFiltersResult {
  const [filters, setFilters] = useState<MailFilterState>(() => ({
    ...createDefaultMailFilters(),
    ...initial,
  }));

  const patch = useCallback((next: Partial<MailFilterState>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const setSearch = useCallback((value: string) => patch({ search: value }), [patch]);

  const setPeriod = useCallback((preset: MailPeriodPreset) => patch({ period: preset }), [patch]);

  const setCustomRange = useCallback(
    (from: string, to: string) => patch({ period: 'custom', customFrom: from, customTo: to }),
    [patch],
  );

  const toggleAccountingObject = useCallback(
    (id: string) =>
      setFilters((prev) => ({
        ...prev,
        accountingObjectIds: toggleInList(prev.accountingObjectIds, id),
      })),
    [],
  );

  const toggleWithoutAccountingObject = useCallback(
    () =>
      setFilters((prev) => ({
        ...prev,
        withoutAccountingObject: !prev.withoutAccountingObject,
        // «Без объекта учёта» и конкретные объекты взаимоисключающи: `buildMailFilter`
        // отдаёт приоритет withoutAccountingObject, молча теряя выбранные id.
        accountingObjectIds: prev.withoutAccountingObject ? prev.accountingObjectIds : [],
      })),
    [],
  );

  const toggleDeliveryMethod = useCallback(
    (method: DeliveryMethod) =>
      setFilters((prev) => ({
        ...prev,
        deliveryMethods: toggleInList(prev.deliveryMethods, method),
      })),
    [],
  );

  const toggleWithoutDeliveryMethod = useCallback(
    () =>
      setFilters((prev) => ({
        ...prev,
        withoutDeliveryMethod: !prev.withoutDeliveryMethod,
        deliveryMethods: prev.withoutDeliveryMethod ? prev.deliveryMethods : [],
      })),
    [],
  );

  const toggleResponsible = useCallback(
    (id: string) =>
      setFilters((prev) => ({ ...prev, responsibleIds: toggleInList(prev.responsibleIds, id) })),
    [],
  );

  const setCounterparty = useCallback((value: string) => patch({ counterparty: value }), [patch]);

  const setAttachments = useCallback(
    (value: MailAttachmentFilter) => patch({ attachments: value }),
    [patch],
  );

  const cycleAttachments = useCallback(
    () => setFilters((prev) => ({ ...prev, attachments: cycleAttachmentFilter(prev.attachments) })),
    [],
  );

  const toggleHasRelations = useCallback(
    () => setFilters((prev) => ({ ...prev, hasRelations: !prev.hasRelations })),
    [],
  );

  const resetGroup = useCallback((group: MailFilterGroup) => {
    setFilters((prev) => resetFilterGroup(prev, group));
  }, []);

  const resetAll = useCallback(() => {
    setFilters((prev) => ({ ...createDefaultMailFilters(), search: prev.search }));
  }, []);

  /**
   * Снятие чипа по `value`: «Склад» снимает именно «Склад», а «Без объекта
   * учёта» — сам переключатель, не трогая выбранные объекты.
   */
  const removeChip = useCallback((chip: MailFilterChip) => {
    setFilters((prev) => {
      switch (chip.group) {
        case 'period':
          return resetFilterGroup(prev, 'period');
        case 'accountingObject':
          if (chip.value === WITHOUT_OBJECT_VALUE) {
            return { ...prev, withoutAccountingObject: false };
          }
          return {
            ...prev,
            accountingObjectIds: prev.accountingObjectIds.filter((id) => id !== chip.value),
          };
        case 'deliveryMethod':
          if (chip.value === WITHOUT_METHOD_VALUE) {
            return { ...prev, withoutDeliveryMethod: false };
          }
          return {
            ...prev,
            deliveryMethods: prev.deliveryMethods.filter((method) => method !== chip.value),
          };
        case 'responsible':
          return { ...prev, responsibleIds: prev.responsibleIds.filter((id) => id !== chip.value) };
        case 'counterparty':
          return { ...prev, counterparty: '' };
        case 'attachments':
          return { ...prev, attachments: 'any' };
        case 'relations':
          return { ...prev, hasRelations: false };
      }
    });
  }, []);

  const query = useMemo(() => buildMailListQuery(filters), [filters]);
  const activeGroups = useMemo(() => activeFilterGroups(filters), [filters]);

  return {
    filters,
    query,
    activeGroups,
    activeCount: activeGroups.length,
    hasSearch: filters.search.trim().length > 0,
    setSearch,
    setPeriod,
    setCustomRange,
    toggleAccountingObject,
    toggleWithoutAccountingObject,
    toggleDeliveryMethod,
    toggleWithoutDeliveryMethod,
    toggleResponsible,
    setCounterparty,
    cycleAttachments,
    setAttachments,
    toggleHasRelations,
    removeChip,
    resetGroup,
    resetAll,
  };
}

/** Границы периода для архива: тот же резолвер, но для удалённых писем. */
export function archivePeriodBounds(state: MailFilterState): {
  dateFrom?: string;
  dateTo?: string;
} {
  const { dateFrom, dateTo } = resolvePeriodBounds(state.period, state.customFrom, state.customTo);
  return { dateFrom: dateKeyToBound(dateFrom), dateTo: dateKeyToBound(dateTo) };
}
