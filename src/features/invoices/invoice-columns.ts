import type { InvoiceColumnId } from '@/shared/types';

export interface InvoiceColumnDef {
  id: InvoiceColumnId;
  label: string;
}

export const ALL_INVOICE_COLUMNS: InvoiceColumnDef[] = [
  { id: 'counterparty', label: 'Контрагент' },
  { id: 'purpose', label: 'Назначение платежа' },
  { id: 'contract_no', label: 'Договор' },
  { id: 'invoice_no', label: 'Счет' },
  { id: 'amount', label: 'Сумма' },
  { id: 'paid', label: 'Оплачено' },
  { id: 'paid_date', label: 'Дата оплаты' },
  { id: 'comment', label: 'Комментарий' },
  { id: 'files', label: 'Файлы' },
  { id: 'actions', label: 'Действия' },
  { id: 'payment_mark', label: 'Отметка' },
];

export const DEFAULT_VISIBLE_COLUMNS: InvoiceColumnId[] = ALL_INVOICE_COLUMNS.map(
  (c) => c.id,
);
