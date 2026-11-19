import {
  MAIL_ATTACHMENT_FILTER_LABELS,
  MAIL_COUNTERPARTY_FIELD_LABELS,
  MAIL_NO_ACCOUNTING_OBJECT_LABEL,
  MAIL_NO_DELIVERY_METHOD_LABEL,
} from '../mail-labels';
import { formatPeriodBounds } from '../mail-date';
import type {
  MailFilterChip,
  MailFilterChipContext,
  MailFilterState,
} from './mail-filter-types';
import { resetFilterGroup } from './mail-filter-state';

/** Значения `MailFilterChip.value`, зарезервированные под переключатели. */
export const WITHOUT_OBJECT_VALUE = '__without_object__';
export const WITHOUT_METHOD_VALUE = '__without_delivery__';

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

/**
 * Снятие чипа по `value`: «Склад» снимает именно «Склад», а «Без объекта
 * учёта» — сам переключатель, не трогая выбранные объекты.
 */
export function removeFilterChip(state: MailFilterState, chip: MailFilterChip): MailFilterState {
  switch (chip.group) {
    case 'period':
      return resetFilterGroup(state, 'period');
    case 'accountingObject':
      if (chip.value === WITHOUT_OBJECT_VALUE) {
        return { ...state, withoutAccountingObject: false };
      }
      return {
        ...state,
        accountingObjectIds: state.accountingObjectIds.filter((id) => id !== chip.value),
      };
    case 'deliveryMethod':
      if (chip.value === WITHOUT_METHOD_VALUE) {
        return { ...state, withoutDeliveryMethod: false };
      }
      return {
        ...state,
        deliveryMethods: state.deliveryMethods.filter((method) => method !== chip.value),
      };
    case 'responsible':
      return { ...state, responsibleIds: state.responsibleIds.filter((id) => id !== chip.value) };
    case 'counterparty':
      return { ...state, counterparty: '' };
    case 'attachments':
      return { ...state, attachments: 'any' };
    case 'relations':
      return { ...state, hasRelations: false };
  }
}
