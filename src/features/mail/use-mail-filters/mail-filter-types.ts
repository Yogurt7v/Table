import type { DeliveryMethod, MailType } from '@/shared/types';
import type { MailListQuery } from '@/shared/hooks/useMail';
import { MAIL_ATTACHMENT_FILTER_LABELS } from '../mail-labels';
import type { MailPeriodPreset } from '../mail-date';

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

/**
 * Направление порядка живого реестра. Это НЕ фильтр, а настройка показа, но
 * она лежит в `MailFilterState` намеренно: `MailSection` возвращает страницу на
 * первую при смене ЛЮБОГО поля этого состояния, и отдельный `useState` на
 * направление оставил бы пользователя на пустой странице — смена порядка на
 * третьей странице реестра уменьшает число строк.
 */
export type MailSortDirection = 'desc' | 'asc';

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
  /** `'desc'` — «новые сверху» (по умолчанию), `'asc'` — «старые сверху». */
  sortDirection: MailSortDirection;
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
  sortDirection: 'desc',
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

export interface UseMailFiltersResult {
  filters: MailFilterState;
  /** Готовый `MailListQuery`; стабильная ссылка между рендерами. */
  query: MailListQuery;
  activeGroups: MailFilterGroup[];
  activeCount: number;
  hasSearch: boolean;
  /** Порядок реестра: `'desc'` — новые сверху (по умолчанию), `'asc'` — старые сверху. */
  sortDirection: MailSortDirection;
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
  /** Переключает порядок показа. Не трогает ни фильтры, ни счётчик активных. */
  toggleSortDirection: () => void;
  removeChip: (chip: MailFilterChip) => void;
  resetGroup: (group: MailFilterGroup) => void;
  resetAll: () => void;
}
