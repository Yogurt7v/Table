import type { MailHistoryType, MailType } from '@/shared/types';

/**
 * Все пользовательские подписи реестра почты в одном месте — по образцу
 * `INVOICE_FILTER_LABELS`. JSX не должен содержать сырых строковых констант,
 * которые используются больше одного раза: здесь же лежат подписи для
 * диффов истории и вкладок.
 */

/** Вкладка регистра. */
export const MAIL_REGISTER_TAB_LABELS: Record<MailType, string> = {
  incoming: 'Входящие',
  outgoing: 'Исходящие',
};

/** Единственное письмо — в заголовках модалок и тостах. */
export const MAIL_TYPE_LABELS: Record<MailType, string> = {
  incoming: 'Входящее письмо',
  outgoing: 'Исходящее письмо',
};

/** Регистр для бейджа: без слова «письмо», которое `MAIL_TYPE_LABELS` несёт в прозе. */
export const MAIL_REGISTER_BADGE_LABELS: Record<MailType, string> = {
  incoming: 'Входящее',
  outgoing: 'Исходящее',
};

/** Оттенок бейджа регистра: входящее — холодное, исходящее — тёплое. */
export const MAIL_REGISTER_COLORS: Record<MailType, string> = {
  incoming: 'blue',
  outgoing: 'orange',
};

/** Кто прислал / кому отправлено — заголовок колонки и фильтр «Контрагент». */
export const MAIL_COUNTERPARTY_FIELD_LABELS: Record<MailType, string> = {
  incoming: 'Отправитель',
  outgoing: 'Получатель',
};

/** Номер письма в своём регистре. */
export const MAIL_NUMBER_FIELD_LABELS: Record<MailType, string> = {
  incoming: 'Номер письма',
  outgoing: 'Исходящий номер',
};

/** Номер письма контрагента (входящее) либо номер, по которому нас ждут (исходящее). */
export const MAIL_COUNTERPARTY_NUMBER_FIELD_LABELS: Record<MailType, string> = {
  incoming: 'Номер отправителя',
  outgoing: 'Номер контрагента',
};

/** Период — предустановки над таблицей и внутри меню фильтров. */
export const MAIL_PERIOD_PRESET_LABELS = {
  today: 'Сегодня',
  week: '7 дней',
  month: 'Месяц',
  all: 'Всё время',
  custom: 'Свой период',
} as const;

/** Заголовки групп меню фильтров. */
export const MAIL_FILTER_GROUP_LABELS = {
  period: 'Период',
  accountingObject: 'Объект учёта',
  deliveryMethod: 'Способ доставки',
  responsible: 'Ответственный',
  counterparty: 'Контрагент',
  attachments: 'Вложения',
  relations: 'Связанные письма',
} as const;

/** Режим отбора по вложениям — три взаимоисключающих состояния, а не два флага. */
export const MAIL_ATTACHMENT_FILTER_LABELS = {
  any: 'Любые',
  with: 'Есть вложения',
  without: 'Без вложений',
} as const;

export const MAIL_HISTORY_TYPE_LABELS: Record<MailHistoryType, string> = {
  created: 'Письмо создано',
  updated: 'Изменены поля письма',
  deleted: 'Письмо удалено',
  restored: 'Письмо восстановлено из архива',
  linked: 'Письмо связано с другим',
  unlinked: 'Связь с письмом снята',
};

/** Подписи полей для diff-чипов в истории. */
export const MAIL_HISTORY_FIELD_LABELS: Record<string, string> = {
  date: 'Дата',
  seq: 'Порядковый номер',
  number: 'Номер письма',
  outgoing_number: 'Исходящий номер',
  sender_outgoing_number: 'Номер отправителя',
  counterparty_incoming_number: 'Номер контрагента',
  sender: 'Отправитель',
  recipient: 'Получатель',
  subject: 'Тема',
  responsible: 'Ответственный',
  responsible_name: 'Ответственный',
  accounting_object_id: 'Объект учёта',
  delivery_method: 'Способ доставки',
  comment: 'Комментарий',
  deleted_by_name: 'Удалён',
  deleted_at: 'Дата удаления',
  relation_id: 'Связь',
  child_id: 'Связанное письмо',
  parent_id: 'Связанное письмо',
  child_type: 'Реестр связанного письма',
  parent_type: 'Реестр связанного письма',
};

/**
 * Поля служебные: их смена не читается как правка письма — служебные записи
 * истории (удаление, восстановление, связывание) показываются своей подписью.
 */
export const MAIL_HISTORY_HIDDEN_FIELDS = new Set([
  'organization_id',
  'created_by',
  'updated_by',
  'child_type',
  'parent_type',
]);

/** Пустые значения ячейки — прочерк в таблице, слово в карточке. */
export const MAIL_EMPTY_CELL = '—';
export const MAIL_NO_ACCOUNTING_OBJECT_LABEL = 'Без объекта учёта';
export const MAIL_NO_DELIVERY_METHOD_LABEL = 'Не указан';
export const MAIL_NO_RESPONSIBLE_LABEL = 'Не назначен';
