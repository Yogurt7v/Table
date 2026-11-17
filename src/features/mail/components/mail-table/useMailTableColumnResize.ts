import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { MailColumnId } from '@/features/mail/mail-columns';
import {
  clampShare,
  loadColumnSizing,
  resolveColumnShares,
  saveColumnSizing,
  type ColumnSizingState,
} from '@/features/mail/mail-table-column-sizing';
import { MIN_COLUMN_WIDTH_PX } from './mail-table-styles';

/** Параметры ширин колонок таблицы писем. */
export interface UseMailTableColumnResizeParams {
  orgId: string;
  columnIds: MailColumnId[];
}

/**
 * Ширины колонок таблицы писем.
 * Хранит доли колонок в localStorage, перечитывает их при смене организации
 * и обрабатывает перетаскивание разделителя в заголовке.
 */
export function useMailTableColumnResize({ orgId, columnIds }: UseMailTableColumnResizeParams) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    loadColumnSizing(orgId),
  );
  const columnSizingRef = useRef<ColumnSizingState>(columnSizing);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const resizingRef = useRef<{
    colId: MailColumnId;
    startX: number;
    startShare: number;
    minShare: number;
  } | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const resizePosRef = useRef<number>(0);

  const shares = resolveColumnShares(columnIds, columnSizing);

  useEffect(() => {
    columnSizingRef.current = columnSizing;
  }, [columnSizing]);

  useEffect(() => {
    const sizing = loadColumnSizing(orgId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumnSizing(sizing);
    columnSizingRef.current = sizing;
  }, [orgId]);

  /** Начинает перетаскивание разделителя: дальше ширина следует за указателем. */
  const handleResizeStart = (colId: MailColumnId, event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const tableWidth = tableRef.current?.getBoundingClientRect().width ?? 0;
    if (tableWidth <= 0) return;
    resizingRef.current = {
      colId,
      startX: event.clientX,
      startShare: shares.get(colId) ?? 0,
      minShare: (MIN_COLUMN_WIDTH_PX / tableWidth) * 100,
    };

    const applyResize = () => {
      resizeFrameRef.current = null;
      const state = resizingRef.current;
      if (!state) return;
      const deltaShare = ((resizePosRef.current - state.startX) / tableWidth) * 100;
      const next = Math.max(state.minShare, clampShare(state.startShare + deltaShare));
      setColumnSizing((prev) => ({ ...prev, [state.colId]: next }));
    };

    const handleMouseMove = (mouseEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      resizePosRef.current = mouseEvent.clientX;
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

  return { tableRef, shares, handleResizeStart };
}
