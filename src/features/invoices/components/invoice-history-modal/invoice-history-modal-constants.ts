/** Подписи полей счёта в карточке правки; ключ — поле `previous_data`. */
export const FIELD_LABELS: Record<string, string> = {
  counterparty: 'Контрагент',
  purpose: 'Назначение',
  contract_no: 'Договор',
  invoice_no: 'Номер счёта',
  amount: 'Сумма',
  comment: 'Комментарий',
  created_by_name: 'Инициатор',
};

/**
 * Служебные поля снимка, которые не показываются пользователю: оплата
 * раскрывается отдельной карточкой «Оплачено», а служебные суммы — только
 * через неё же.
 */
export const HIDDEN_FIELDS = new Set([
  'payment_amounts',
  'paid_amount',
  'remaining',
  'removed_amount',
  'payment',
  'paid',
  'paid_date',
  'created_by',
]);
