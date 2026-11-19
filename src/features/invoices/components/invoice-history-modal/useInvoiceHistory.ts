import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInvoiceHistoryChain } from '@/api/collections';
import { computeHistoryDiffs } from './invoice-history-modal-utils';
import type { HistoryEntryDiffs } from './invoice-history-modal-types';

/**
 * Данные модалки истории счёта: запрос цепочки, разбор в записи и признаки
 * для шапки. Возвращает `{ isLoading, isError, error, entries, hasDiff, isCopyInvoice }`.
 *
 * Ключ запроса — `['invoice_history', invoiceId]`: у каждого счёта своя
 * история, а при закрытой модалке запрос не делается вовсе.
 */
export function useInvoiceHistory(invoiceId: string | null, opened: boolean) {
  const {
    data: saga,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['invoice_history', invoiceId],
    queryFn: () => getInvoiceHistoryChain(invoiceId!),
    enabled: opened && !!invoiceId,
  });

  useEffect(() => {
    if (isError && error) {
      console.error('[InvoiceHistoryModal]', error);
    }
  }, [isError, error]);

  const entries: HistoryEntryDiffs[] = saga
    ? saga.flatMap(({ invoice, history }) =>
        computeHistoryDiffs(history, invoice, !!invoice.original_invoice_id),
      )
    : [];
  entries.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

  return {
    isLoading,
    isError,
    error,
    entries,
    hasDiff: entries.some((e) => e.kind === 'edit' && e.diffs.length > 0),
    isCopyInvoice: Boolean(saga?.[0]?.invoice?.original_invoice_id),
  };
}
