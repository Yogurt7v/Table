import { Paper, Stack, Text } from '@mantine/core';
import type { DocumentColumnId, IDocument, IDocumentComment, IDocumentFile } from '@/shared/types';
import { DOCUMENT_COLUMNS, type DocumentColumnSizing } from './document-columns';
import { DocumentsTableGroup } from './components/documents-table/DocumentsTableGroup';
import type {
  DocumentGroup,
  DocumentsTableData,
  DocumentsTableHandlers,
} from './components/documents-table/documents-table-types';

export type { DocumentGroup } from './components/documents-table/documents-table-types';

interface DocumentsTableProps {
  groups: DocumentGroup[];
  visibleColumns: DocumentColumnId[];
  sizing: DocumentColumnSizing;
  filesByDocument: Record<string, IDocumentFile[]>;
  commentsByDocument: Record<string, IDocumentComment[]>;
  pageSize: number;
  collapsedIds: Set<string>;
  onToggleCollapse: (objectId: string) => void;
  onPageChange: (objectId: string, page: number) => void;
  onWidthChange: (columnId: DocumentColumnId, width: number) => void;
  onWidthCommit: () => void;
  onOpenDocument: (document: IDocument, tab?: 'document' | 'files' | 'comments') => void;
  highlightDocumentId?: string | null;
  highlightRowRef?: (node: HTMLTableRowElement | null) => void;
}

/**
 * Таблица документов, сгруппированная по объектам учёта.
 * Рендерит по группе на объект: сворачиваемый заголовок, таблицу на десктопе,
 * карточки на мобильных и пагинацию. Состав колонок приходит готовым из
 * родителя (`visibleColumns`) и раздаётся  group-компонентам.
 */
export function DocumentsTable({
  groups,
  visibleColumns,
  sizing,
  filesByDocument,
  commentsByDocument,
  pageSize,
  collapsedIds,
  onToggleCollapse,
  onPageChange,
  onWidthChange,
  onWidthCommit,
  onOpenDocument,
  highlightDocumentId,
  highlightRowRef,
}: DocumentsTableProps) {
  const columns = visibleColumns.flatMap((id) =>
    DOCUMENT_COLUMNS.filter((column) => column.id === id),
  );
  const data: DocumentsTableData = {
    visibleColumns,
    sizing,
    filesByDocument,
    commentsByDocument,
    highlightDocumentId,
    highlightRowRef,
  };
  const handlers: DocumentsTableHandlers = {
    onToggleCollapse,
    onPageChange,
    onWidthChange,
    onWidthCommit,
    onOpenDocument,
  };

  return (
    <Stack gap="md">
      {/* Группы документов по объектам учёта */}
      {groups.map((group) => (
        <DocumentsTableGroup
          key={group.objectId}
          group={group}
          columns={columns}
          data={data}
          handlers={handlers}
          pageSize={pageSize}
          collapsed={collapsedIds.has(group.objectId)}
        />
      ))}

      {/* Пустое состояние: по запросу документов нет */}
      {groups.length === 0 && (
        <Paper withBorder p="xl">
          <Text c="dimmed" ta="center">
            Документов не найдено
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
