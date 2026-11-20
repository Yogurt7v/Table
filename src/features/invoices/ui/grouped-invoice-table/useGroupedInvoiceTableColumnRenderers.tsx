import { createAmountColumnRenderer } from './column-renderers/amountRenderer';
import { createFilesColumnRenderer } from './column-renderers/filesRenderer';
import { createMetaColumnRenderers } from './column-renderers/metaRenderers';
import { createPaidColumnRenderers } from './column-renderers/paidRenderers';
import { createTextColumnRenderers } from './column-renderers/textRenderers';
import type {
  GroupedInvoiceTableColumnRenderers,
  GroupedInvoiceTableColumnRenderersParams,
  InvoiceColumnRenderer,
} from './column-renderers/types';

export type { GroupedInvoiceTableColumnRenderersParams, InvoiceColumnRenderer };

/**
 * Возвращает конфигурацию рендереров колонок десктопной таблицы:
 * заголовок, ширина по умолчанию, рендер ячейки и рендер черновика.
 */
export function useGroupedInvoiceTableColumnRenderers(
  params: GroupedInvoiceTableColumnRenderersParams,
): GroupedInvoiceTableColumnRenderers {
  const text = createTextColumnRenderers(params);
  const amount = createAmountColumnRenderer(params);
  const paid = createPaidColumnRenderers(params);
  const files = createFilesColumnRenderer(params);
  const meta = createMetaColumnRenderers(params);

  return {
    counterparty: text.counterparty,
    purpose: text.purpose,
    contract_no: text.contract_no,
    invoice_no: text.invoice_no,
    amount,
    paid: paid.paid,
    paid_date: paid.paid_date,
    comment: text.comment,
    files,
    actions: meta.actions,
    payment_mark: meta.payment_mark,
    initiator: meta.initiator,
  };
}
