import { useCallback, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import type { IAccountingObject, IInvoice } from '@/shared/types';
import { useCollapsedObjects } from '@/shared/context/CollapsedObjectsContext';
import { useInvoiceNavigation } from '@/shared/context/InvoiceNavigationContext';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { findVisibleHighlightEl, flashHighlightRow } from './invoice-section-highlight';

export function AutoExpandOnHighlight({
  highlightedInvoiceId,
  highlightRequestId,
  highlightDateCandidates,
  objects,
  invoices,
}: {
  highlightedInvoiceId: string | null;
  highlightRequestId: number;
  highlightDateCandidates: string[];
  objects: IAccountingObject[] | undefined;
  invoices: IInvoice[] | undefined;
}) {
  const { expand } = useCollapsedObjects();
  const { selectedDate, setSelectedDate } = useInvoiceNavigation();
  const selectedDay = dayjs(selectedDate).format('YYYY-MM-DD');

  // Если по цепочке дат (день уведомления -> сегодня/день счёта и т.п.) счёт не найден
  // в данных выбранного дня, пробуем следующий день-кандидат.
  useEffect(() => {
    if (!highlightedInvoiceId || !highlightDateCandidates.length || !invoices) return;
    const candidateIndex = highlightDateCandidates.indexOf(selectedDay);
    if (candidateIndex === -1) return;
    if (invoices.some((i) => i.id === highlightedInvoiceId)) return;
    if (candidateIndex < highlightDateCandidates.length - 1) {
      const nextDay = highlightDateCandidates[candidateIndex + 1]!;
      const [y, m, d] = nextDay.split('-').map(Number);
      setSelectedDate(new Date(y ?? 1, (m ?? 1) - 1, d ?? 1));
    }
  }, [
    highlightDateCandidates,
    highlightedInvoiceId,
    highlightRequestId,
    invoices,
    selectedDay,
    setSelectedDate,
  ]);

  const pollIntervalRef = useRef<number | null>(null);
  const stopHighlightPolling = useCallback(() => {
    if (pollIntervalRef.current != null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);
  useEffect(() => () => stopHighlightPolling(), [stopHighlightPolling]);

  // Эффект A: разворачиваем объект, содержащий подсвечиваемый счёт.
  // Зависит от objects/invoices — если при первом срабатывании objects ещё
  // пустые (переход из /docs через уведомление), эффект перезапустится при
  // их загрузке и вызовет expand повторно. expand идемпотентен (no-op если
  // объект уже развёрнут), поэтому повторные вызовы безопасны.
  useEffect(() => {
    if (!highlightedInvoiceId || !invoices || !objects) return;
    const target = invoices.find((i) => i.id === highlightedInvoiceId);
    if (!target) return;
    const objectId = normalizeRelationId(target.accounting_object_id);
    const hasObject = objects.some((o) => o.id === objectId);
    if (hasObject) expand([objectId]);
  }, [highlightedInvoiceId, invoices, objects, expand]);

  // Эффект B: ищем строку счёта в DOM и подсвечиваем + скроллим к ней.
  // Зависит от highlightRequestId, чтобы перезапускаться при новом запросе
  // подсветки (новый навигационный переход).
  useEffect(() => {
    if (!highlightedInvoiceId || !invoices) return;
    const target = invoices.find((i) => i.id === highlightedInvoiceId);
    if (!target) return;

    // Строка появляется после раскрытия группы и рендера таблицы, поэтому
    // поллим DOM до её появления: единичный ретрай через 120ms терял подсветку
    // при медленном рендере. Интервал живёт в ref, чтобы рефетч invoices
    // не убивал ожидание через cleanup эффекта.
    stopHighlightPolling();

    // Небольшая задержка перед началом polling, чтобы дать время на
    // анимацию открытия объекта (Collapse). Иначе строка счёта может ещё
    // не быть отрисована в DOM при первом опросе.
    const startPolling = () => {
      const startedAt = Date.now();
      pollIntervalRef.current = window.setInterval(() => {
        const el = findVisibleHighlightEl(highlightedInvoiceId);
        if (el) {
          stopHighlightPolling();
          flashHighlightRow(highlightedInvoiceId);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (Date.now() - startedAt > 5000) stopHighlightPolling();
      }, 100);
    };
    pollIntervalRef.current = window.setTimeout(startPolling, 400);
  }, [highlightedInvoiceId, highlightRequestId, invoices, stopHighlightPolling]);

  // Компонент не рендерит UI: только эффекты авто-разворачивания,
  // подсветки и скролла к строке счёта.
  return null;
}
