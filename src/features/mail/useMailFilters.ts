/** Публичный API фильтров почты: типы, чистые утилиты, построители и хук. */
export {
  DEFAULT_MAIL_FILTERS,
  MAIL_FILTER_GROUPS,
  type MailAttachmentFilter,
  type MailFilterChip,
  type MailFilterChipContext,
  type MailFilterGroup,
  type MailFilterState,
  type MailSortDirection,
  type UseMailFiltersResult,
} from './use-mail-filters/mail-filter-types';
export {
  activeFilterGroups,
  createDefaultMailFilters,
  cycleAttachmentFilter,
  hasActiveFilters,
  nextSortDirection,
  resetFilterGroup,
  toggleInList,
} from './use-mail-filters/mail-filter-state';
export { archivePeriodBounds, buildMailListQuery } from './use-mail-filters/mail-filter-query';
export { buildFilterChips } from './use-mail-filters/mail-filter-chips';
export { useMailFilters } from './use-mail-filters/useMailFilters';
