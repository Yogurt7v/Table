import { useState, useRef, useEffect } from 'react';
import {
  loadColumnSizing,
  saveColumnSizing,
  type ColumnSizingState,
} from '@/features/invoices/invoice-table-column-sizing';

/** Параметры хука для управления шириной колонок. */
export interface UseGroupedInvoiceTableColumnSizingParams {
  orgId: string;
}

/**
 * Хук для управления шириной колонок таблицы счетов.
 * Загружает сохранённые размеры, обрабатывает изменение размеров мышью
 * и сохраняет результат в хранилище.
 */
export function useGroupedInvoiceTableColumnSizing({
  orgId,
}: UseGroupedInvoiceTableColumnSizingParams) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    loadColumnSizing(orgId),
  );
  const columnSizingRef = useRef<ColumnSizingState>(columnSizing);

  useEffect(() => {
    columnSizingRef.current = columnSizing;
  }, [columnSizing]);

  useEffect(() => {
    const sizing = loadColumnSizing(orgId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация сохранённых ширин при смене организации
    setColumnSizing(sizing);
  }, [orgId]);

  const resizingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const resizePosRef = useRef<number>(0);

  const handleResizeStart = (colId: string, e: React.MouseEvent, startWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colId, startX: e.clientX, startWidth };

    const applyResize = () => {
      resizeFrameRef.current = null;
      const state = resizingRef.current;
      if (!state) return;
      const delta = resizePosRef.current - state.startX;
      const newWidth = Math.max(50, state.startWidth + delta);
      setColumnSizing((prev) => ({ ...prev, [state.colId]: newWidth }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      resizePosRef.current = e.clientX;
      if (resizeFrameRef.current !== null) return;
      resizeFrameRef.current = requestAnimationFrame(applyResize);
    };

    const handleMouseUp = () => {
      if (resizingRef.current) {
        saveColumnSizing(orgId, columnSizingRef.current);
      }
      resizingRef.current = null;
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return {
    columnSizing,
    handleResizeStart,
  };
}
