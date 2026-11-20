import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Table } from '@mantine/core';
import type { DocumentColumnId } from '@/shared/types';
import type { DocumentColumnDefinition } from '@/features/documents/model/document-columns';

/** Пропсы заголовка колонки с изменением ширины. */
export interface DocumentsTableResizableHeaderProps {
  column: DocumentColumnDefinition;
  width: number;
  onWidthChange: (columnId: DocumentColumnId, width: number) => void;
  onWidthCommit: () => void;
}

/**
 * Заголовок колонки таблицы документов.
 * Рендерит подпись колонки и разделитель, за который ширина тянется указателем.
 */
export function DocumentsTableResizableHeader({
  column,
  width,
  onWidthChange,
  onWidthCommit,
}: DocumentsTableResizableHeaderProps) {
  const startRef = useRef<{ x: number; width: number } | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    startRef.current = { x: event.clientX, width };
    const handleMove = (moveEvent: PointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      onWidthChange(column.id, Math.max(56, start.width + moveEvent.clientX - start.x));
    };
    const handleUp = () => {
      startRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      onWidthCommit();
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <Table.Th
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        textAlign: column.align ?? 'left',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {column.label}
      {/* Разделитель справа: тянем его, чтобы изменить ширину колонки */}
      <span
        role="separator"
        aria-label={`Изменить ширину колонки ${column.label}`}
        onPointerDown={handlePointerDown}
        style={{
          position: 'absolute',
          top: 0,
          right: -3,
          width: 7,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 2,
        }}
      />
    </Table.Th>
  );
}
