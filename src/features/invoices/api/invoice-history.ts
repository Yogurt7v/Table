/** История изменений счетов и записи истории по меткам оплаты. */

import { pb } from '@/api/client';
import type { IInvoiceHistory, InvoiceHistoryType } from '@/shared/types';
import { getCurrentAuthor } from '@/api/collections/shared';

/** Возвращает историю изменений счёта, от новых записей к старым. */
export function getInvoiceHistory(invoiceId: string) {
  return pb.collection('invoice_history').getFullList<IInvoiceHistory>({
    filter: `invoice_id = "${invoiceId}"`,
    sort: '-changed_at',
  });
}

/** Создаёт запись истории счёта от имени текущего актора. */
export function createInvoiceHistoryRecord(
  invoiceId: string,
  data: { type?: InvoiceHistoryType; previous_data: Record<string, unknown> },
) {
  return pb.collection('invoice_history').create<IInvoiceHistory>({
    invoice_id: invoiceId,
    author: getCurrentAuthor(),
    changed_at: new Date().toISOString(),
    type: data.type ?? '',
    previous_data: data.previous_data,
  });
}

/** Создаёт запись истории счёта для создания/удаления метки оплаты. */
export function createPaymentMarkHistory(
  invoiceId: string,
  type: 'mark_created' | 'mark_deleted',
  markData: Record<string, unknown>,
) {
  return createInvoiceHistoryRecord(invoiceId, { type, previous_data: markData });
}
