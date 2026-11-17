import {
  Box,
  Group,
  Pagination,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import {
  getDocumentColumnWidth,
  type DocumentColumnDefinition,
} from '@/features/documents/document-columns';
import { DocumentMobileCards } from '@/features/documents/DocumentMobileCards';
import { DocumentsTableResizableHeader } from './DocumentsTableResizableHeader';
import { DocumentsTableRow } from './DocumentsTableRow';
import type {
  DocumentGroup,
  DocumentsTableData,
  DocumentsTableHandlers,
} from './documents-table-types';

/** Пропсы группы документов одного объекта учёта. */
export interface DocumentsTableGroupProps {
  group: DocumentGroup;
  columns: DocumentColumnDefinition[];
  data: DocumentsTableData;
  handlers: DocumentsTableHandlers;
  pageSize: number;
  collapsed: boolean;
}

/**
 * Группа документов одного объекта учёта.
 * Рендерит сворачиваемый заголовок, таблицу на десктопе, карточки на мобильных
 * и пагинацию группы.
 */
export function DocumentsTableGroup({
  group,
  columns,
  data,
  handlers,
  pageSize,
  collapsed,
}: DocumentsTableGroupProps) {
  const totalPages = Math.max(1, Math.ceil(group.total / pageSize));
  const totalWidth = columns.reduce(
    (sum, column) => sum + getDocumentColumnWidth(column, data.sizing),
    0,
  );

  return (
    <Paper withBorder p="sm" style={{ borderLeft: '3px solid var(--org-color, #228be6)' }}>
      {/* Заголовок группы: имя объекта учёта и число документов, клик сворачивает группу */}
      <Group
        justify="space-between"
        mb="xs"
        wrap="nowrap"
        onClick={() => handlers.onToggleCollapse(group.objectId)}
        style={{ cursor: 'pointer' }}
      >
        <Group gap="xs" wrap="nowrap">
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronDown size={16} />}
          <Title order={5}>{group.objectName}</Title>
        </Group>
        <Text size="sm" c="dimmed">
          {group.total}
        </Text>
      </Group>

      {!collapsed && (
        <>
          {/* Табличное представление (десктоп) */}
          <Box visibleFrom="sm">
            <ScrollArea type="auto" offsetScrollbars>
              <Table
                highlightOnHover
                withTableBorder
                withColumnBorders
                style={{ minWidth: totalWidth, tableLayout: 'fixed' }}
              >
                <Table.Thead>
                  <Table.Tr>
                    {columns.map((column) => (
                      <DocumentsTableResizableHeader
                        key={column.id}
                        column={column}
                        width={getDocumentColumnWidth(column, data.sizing)}
                        onWidthChange={handlers.onWidthChange}
                        onWidthCommit={handlers.onWidthCommit}
                      />
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {group.documents.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={columns.length} ta="center" c="dimmed">
                        Документов нет
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    group.documents.map((document) => (
                      <DocumentsTableRow
                        key={document.id}
                        document={document}
                        columns={columns}
                        files={data.filesByDocument[document.id] ?? []}
                        comments={data.commentsByDocument[document.id] ?? []}
                        highlight={
                          Boolean(data.highlightDocumentId) &&
                          document.id === data.highlightDocumentId
                        }
                        highlightRowRef={data.highlightRowRef}
                        onOpen={(tab) => handlers.onOpenDocument(document, tab)}
                      />
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Box>

          {/* Мобильное представление: карточки документов */}
          <Stack hiddenFrom="sm" gap="sm">
            <DocumentMobileCards
              documents={group.documents}
              visibleColumns={data.visibleColumns}
              filesByDocument={data.filesByDocument}
              commentsByDocument={data.commentsByDocument}
              onOpenDocument={handlers.onOpenDocument}
              highlightDocumentId={data.highlightDocumentId}
            />
          </Stack>

          {/* Пагинация группы: только если страниц больше одной */}
          {group.total > pageSize && (
            <Group justify="center" mt="sm">
              <Pagination
                size="sm"
                total={totalPages}
                value={group.page}
                onChange={(page) => handlers.onPageChange(group.objectId, page)}
              />
            </Group>
          )}
        </>
      )}
    </Paper>
  );
}
