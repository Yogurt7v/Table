/** Названия событий истории документа. */
export const HISTORY_LABELS: Record<string, string> = {
  document_created: 'Документ создан вручную',
  document_auto_created: 'Документ создан автоматически',
  document_updated: 'Документ изменён',
  document_synced: 'Данные синхронизированы со счётом',
  file_added: 'Файл добавлен',
  file_removed: 'Файл удалён',
  comment_added: 'Комментарий добавлен',
  comment_deleted: 'Комментарий удалён',
  status_changed: 'Изменены статусы',
  responsible_changed: 'Изменён ответственный',
  object_changed: 'Изменён объект',
  document_archived: 'Документ перемещён в архив',
  document_restored: 'Документ восстановлен',
  payment_cancelled: 'Оплата отменена',
  payment_resumed: 'Оплата возобновлена',
};

/** Подписи полей в деталях истории — без них в истории остались бы сырые имена полей. */
export const DOCUMENT_FIELD_LABELS: Record<string, string> = {
  amount: 'Сумма',
  counterparty: 'Контрагент',
  purpose: 'Назначение',
  contract_no: 'Договор',
  invoice_no: 'Номер счёта',
  payment_date: 'Дата оплаты',
  responsible_id: 'Ответственный',
  accounting_object_id: 'Объект учёта',
  source_invoice_no: 'Номер счёта',
  provided: 'Предоставлен',
  confirmed: 'Подтверждён',
  payment_cancelled: 'Оплата отменена',
  payment_resumed: 'Оплата возобновлена',
  deletion_reason: 'Причина удаления',
};

/** Служебные поля: в деталях истории они только засоряют вывод. */
export const HIDDEN_FIELDS = new Set(['source_invoice_id', 'automatic', 'is_deleted', 'file_id']);
