import { Table } from '@mantine/core';
import type { IDocument, IDocumentComment, IDocumentFile } from '@/shared/types';
import {
  isDocumentCompleted,
  type DocumentColumnDefinition,
} from '@/features/documents/document-columns';
import { renderDocumentCell } from './DocumentsTableCells';

/** Пропсы строки таблицы документов. */
export interface DocumentsTableRowProps {
  document: IDocument;
  columns: DocumentColumnDefinition[];
  files: IDocumentFile[];
  comments: IDocumentComment[];
  highlight: boolean;
  highlightRowRef?: (node: HTMLTableRowElement | null) => void;
  onOpen: (tab?: 'document' | 'files' | 'comments') => void;
}

/**
 * Строка таблицы документов.
 * Рендерит ячейки по составу колонок; клик открывает документ на вкладке
 * «Файлы» или «Комментарии», если кликнули по соответствующей колонке.
 */
export function DocumentsTableRow({
  document,
  columns,
  files,
  comments,
  highlight,
  highlightRowRef,
  onOpen,
}: DocumentsTableRowProps) {
  const completed = isDocumentCompleted(document);
  return (
    <Table.Tr
      ref={highlight ? (highlightRowRef ?? null) : null}
      className={highlight ? 'document-row--highlight' : undefined}
      style={{
        backgroundColor: completed ? 'var(--mantine-color-gray-1)' : undefined,
        color: completed ? 'var(--mantine-color-dimmed)' : undefined,
      }}
      data-document-id={document.id}
    >
      {columns.map((column) => (
        <Table.Td
          key={column.id}
          style={{ textAlign: column.align ?? 'left' }}
          onClick={(event) => {
            event.stopPropagation();
            const tab =
              column.id === 'files' ? 'files' : column.id === 'comments' ? 'comments' : 'document';
            onOpen(tab);
          }}
        >
          {renderDocumentCell(column.id, document, files, comments)}
        </Table.Td>
      ))}
    </Table.Tr>
  );
}
