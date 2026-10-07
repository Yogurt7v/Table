import type { MailType } from '@/shared/types';
import {
  MAIL_COUNTERPARTY_FIELD_LABELS,
  MAIL_COUNTERPARTY_NUMBER_FIELD_LABELS,
  MAIL_NUMBER_FIELD_LABELS,
} from './mail-labels';

export type MailColumnId =
  | 'seq'
  | 'date'
  | 'number'
  | 'counterparty'
  | 'counterparty_number'
  | 'subject'
  | 'responsible_name'
  | 'delivery_method'
  | 'accounting_object_id'
  | 'files'
  | 'created'
  | 'actions';

export interface MailColumnDef {
  id: MailColumnId;
  /** Подпись вне зависимости от регистра; для трёх колонок её перебивает `MailType`. */
  label: string;
  /**
   * Вес колонки в пропорции, а не ширина в пикселях: `table-layout: fixed`
   * берёт ширины первой строки как есть и не ужимает их под контейнер,
   * поэтому сумма в пикселях на широком экране выталкивала «Действия» за
   * пределы `Paper` и давала горизонтальную прокрутку страницы. Доли от суммы
   * весов всегда дают ровно 100% и держат пропорции на любой ширине.
   *
   * Перетаскивание границы не ломает этого инварианта: ручная ширина хранится
   * тоже долей, а `resolveColumnShares` раздаёт остаток между свободными
   * колонками по их весам.
   */
  weight: number;
}

const SEQ = 40;
const DATE = 78;
const NUMBER = 84;
const COUNTERPARTY = 132;
const COUNTERPARTY_NUMBER = 94;
const SUBJECT = 138;
const RESPONSIBLE = 100;
const DELIVERY = 82;
const OBJECT = 108;
// Колонка печатает имя вложения рядом со скрепкой, поэтому держит ширину
// текстовой колонки; вес взят у соседей, а не добавлен к сумме.
const FILES = 168;
const CREATED = 98;
const ACTIONS = 72;

/** Канонический порядок колонок; он же порядок по умолчанию. */
export const ALL_MAIL_COLUMNS: MailColumnDef[] = [
  { id: 'seq', label: '№', weight: SEQ },
  { id: 'date', label: 'Дата', weight: DATE },
  { id: 'number', label: 'Номер письма', weight: NUMBER },
  { id: 'counterparty', label: 'Контрагент', weight: COUNTERPARTY },
  { id: 'counterparty_number', label: 'Номер контрагента', weight: COUNTERPARTY_NUMBER },
  { id: 'subject', label: 'Тема', weight: SUBJECT },
  { id: 'responsible_name', label: 'Ответственный', weight: RESPONSIBLE },
  { id: 'delivery_method', label: 'Способ доставки', weight: DELIVERY },
  { id: 'accounting_object_id', label: 'Объект учёта', weight: OBJECT },
  { id: 'files', label: 'Файлы', weight: FILES },
  { id: 'created', label: 'Дата создания', weight: CREATED },
  { id: 'actions', label: 'Действия', weight: ACTIONS },
];

/**
 * Вес колонки — знаменатель доли, которую забирает ручная ширина.
 * `mail-table-column-sizing` нормирует эти веса по сумме весов ВИДИМЫХ колонок,
 * а не по общей: спрятанная колонка не должна оставлять за собой долю ширины.
 */
export const MAIL_WEIGHT_BY_ID: Record<MailColumnId, number> = Object.fromEntries(
  ALL_MAIL_COLUMNS.map((column) => [column.id, column.weight]),
) as Record<MailColumnId, number>;

export const DEFAULT_VISIBLE_COLUMNS: MailColumnId[] = ALL_MAIL_COLUMNS.map((column) => column.id);

/**
 * Подписи, зависящие от регистра. Входящее письмо отправляет контрагент,
 * исходящее — получатель, и колонка называется соответственно.
 */
const MAIL_TYPE_LABELS: Partial<Record<MailColumnId, Record<MailType, string>>> = {
  number: MAIL_NUMBER_FIELD_LABELS,
  counterparty: MAIL_COUNTERPARTY_FIELD_LABELS,
  counterparty_number: MAIL_COUNTERPARTY_NUMBER_FIELD_LABELS,
};

export interface MailColumn {
  id: MailColumnId;
  header: string;
}

export function getMailColumnLabel(id: MailColumnId, mailType: MailType): string {
  const byType = MAIL_TYPE_LABELS[id];
  if (byType) return byType[mailType];
  const def = ALL_MAIL_COLUMNS.find((column) => column.id === id);
  return def ? def.label : id;
}

/**
 * Заголовки в порядке `visibleIds` — то есть в том порядке, который вернул
 * `resolveVisibleColumns`, а не в захардкоженном. Неизвестный идентификатор
 * пропускается: настройка приходит из хранилища и может устареть.
 */
export function getOrderedColumns(
  visibleIds: readonly MailColumnId[],
  mailType: MailType,
): MailColumn[] {
  const known = new Set<MailColumnId>(DEFAULT_VISIBLE_COLUMNS);
  const result: MailColumn[] = [];
  const added = new Set<MailColumnId>();
  for (const id of visibleIds) {
    if (!known.has(id) || added.has(id)) continue;
    added.add(id);
    result.push({ id, header: getMailColumnLabel(id, mailType) });
  }
  return result;
}

/** Все колонки в каноническом порядке — для мест, где настройки ещё нет. */
export function getMailColumns(mailType: MailType): MailColumn[] {
  return getOrderedColumns(DEFAULT_VISIBLE_COLUMNS, mailType);
}
