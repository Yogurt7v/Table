import { useCallback, useMemo, useState } from 'react';
import type { DeliveryMethod } from '@/shared/types';
import type { MailPeriodPreset } from '../mail-date';
import { removeFilterChip } from './mail-filter-chips';
import { buildMailListQuery } from './mail-filter-query';
import {
  activeFilterGroups,
  createDefaultMailFilters,
  cycleAttachmentFilter,
  nextSortDirection,
  resetFilterGroup,
  toggleInList,
} from './mail-filter-state';
import type {
  MailAttachmentFilter,
  MailFilterChip,
  MailFilterGroup,
  MailFilterState,
  UseMailFiltersResult,
} from './mail-filter-types';

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

  const toggleSortDirection = useCallback(
    () => setFilters((prev) => ({ ...prev, sortDirection: nextSortDirection(prev.sortDirection) })),
    [],
  );

  const resetGroup = useCallback((group: MailFilterGroup) => {
    setFilters((prev) => resetFilterGroup(prev, group));
  }, []);

  /**
   * «Сбросить все фильтры» снимает отбор, но НЕ порядок показа.
   *
   * `search` здесь сохраняется по той же причине, что и `sortDirection`: оба
   * заданы не фильтром, а сверху — общий поиск живёт над вкладками, а порядок
   * выбирает пользователь. Сброс фильтра, возвращающий реестр к «новым
   * сверху», заставил бы `handleGoToRegister` в `MailSection` (переход из дерева
   * переписки к письму по дате) тихо отменить только что выбранный порядок.
   */
  const resetAll = useCallback(() => {
    setFilters((prev) => ({
      ...createDefaultMailFilters(),
      search: prev.search,
      sortDirection: prev.sortDirection,
    }));
  }, []);

  const removeChip = useCallback((chip: MailFilterChip) => {
    setFilters((prev) => removeFilterChip(prev, chip));
  }, []);

  const query = useMemo(() => buildMailListQuery(filters), [filters]);
  const activeGroups = useMemo(() => activeFilterGroups(filters), [filters]);

  return {
    filters,
    query,
    activeGroups,
    activeCount: activeGroups.length,
    hasSearch: filters.search.trim().length > 0,
    sortDirection: filters.sortDirection,
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
    toggleSortDirection,
    removeChip,
    resetGroup,
    resetAll,
  };
}

export type { MailFilterChip, MailFilterGroup };
