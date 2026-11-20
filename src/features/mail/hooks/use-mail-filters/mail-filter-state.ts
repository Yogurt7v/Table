import {
  DEFAULT_MAIL_FILTERS,
  type MailAttachmentFilter,
  type MailFilterGroup,
  type MailFilterState,
  type MailSortDirection,
} from './mail-filter-types';

export function createDefaultMailFilters(): MailFilterState {
  return { ...DEFAULT_MAIL_FILTERS };
}

/**
 * Группы, в которых что-то выбрано — ими питается подпись `Фильтр (N)`.
 *
 * `sortDirection` здесь не упоминается намеренно: это порядок показа, а не
 * отбор, и его не должно быть видно ни в счётчике на кнопке, ни чипом.
 */
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

/** Следующее направление порядка. Направлений ровно два, цикла нет. */
export function nextSortDirection(current: MailSortDirection): MailSortDirection {
  return current === 'desc' ? 'asc' : 'desc';
}

export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
