import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
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
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconChevronDown, IconChevronRight, IconMessage, IconPaperclip, IconX } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { DocumentColumnId, IDocument, IDocumentComment, IDocumentFile } from '@/shared/types';
import {
  DOCUMENT_COLUMNS,
  getDocumentColumnWidth,
  isDocumentCompleted,
  type DocumentColumnSizing,
} from './document-columns';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { DocumentMobileCards } from './DocumentMobileCards';

export interface DocumentGroup {
  objectId: string;
  objectName: string;
  documents: IDocument[];
  total: number;
  page: number;
}

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

function ResizableHeader({
  columnId,
  label,
  width,
  align,
  onWidthChange,
  onWidthCommit,
}: {
  columnId: DocumentColumnId;
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  onWidthChange: (columnId: DocumentColumnId, width: number) => void;
  onWidthCommit: () => void;
}) {
  const startRef = useRef<{ x: number; width: number } | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    startRef.current = { x: event.clientX, width };
    const handleMove = (moveEvent: PointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      onWidthChange(columnId, Math.max(56, start.width + moveEvent.clientX - start.x));
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
        textAlign: align ?? 'left',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {label}
      <span
        role="separator"
        aria-label={`Изменить ширину колонки ${label}`}
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

function StatusCell({ value, label }: { value: boolean; label: string }) {
  return value ? (
    <Tooltip label={label}>
      <IconCheck size={24} color="var(--mantine-color-green-6)" aria-label={label} />
    </Tooltip>
  ) : (
    <Tooltip label={`Не ${label.toLowerCase()}`}>
      <IconX size={24} color="var(--mantine-color-red-5)" aria-label={`Не ${label.toLowerCase()}`} />
    </Tooltip>
  );
}

function renderCell(
  id: DocumentColumnId,
  document: IDocument,
  files: IDocumentFile[],
  comments: IDocumentComment[],
) {
  switch (id) {
    case 'seq':
      return <Text size="sm" lineClamp={2} title={String(document.seq ?? '')}>
        {document.seq ?? '—'}
      </Text>;
    case 'payment_date':
      return (
        <Text size="sm" lineClamp={2} title={document.payment_date ?? ''}>
          {document.payment_date ? dayjs(document.payment_date).format('DD.MM.YYYY') : '—'}
        </Text>
      );
    case 'counterparty':
      return (
        <Text size="sm" lineClamp={2} title={document.counterparty ?? ''}>
          {document.counterparty || '—'}
        </Text>
      );
    case 'purpose':
      return (
        <Text size="sm" lineClamp={2} title={document.purpose ?? ''}>
          {document.purpose || '—'}
        </Text>
      );
    case 'contract_no':
      return (
        <Text size="sm" lineClamp={2} title={document.contract_no ?? ''}>
          {document.contract_no || '—'}
        </Text>
      );
    case 'invoice_no':
      return (
        <Text size="sm" lineClamp={2} title={document.invoice_no ?? ''}>
          {document.invoice_no || '—'}
        </Text>
      );
    case 'amount':
      return (
        <Text size="sm" lineClamp={2} title={document.amount ? formatAmountRub(document.amount) : ''}>
          {document.amount ? formatAmountRub(document.amount) : '—'}
        </Text>
      );
    case 'responsible':
      return (
        <Text size="sm" lineClamp={2} title={document.responsible_name ?? ''}>
          {document.responsible_name || '—'}
        </Text>
      );
    case 'author':
      return (
        <Text size="sm" lineClamp={2} title={document.created_by_name ?? ''}>
          {document.created_by_name || '—'}
        </Text>
      );
    case 'provided':
      return <StatusCell value={document.provided} label="Предоставлен" />;
    case 'confirmed':
      return <StatusCell value={document.confirmed} label="Подтверждён" />;
    case 'files':
      return (
        <Group gap={4} justify="center" wrap="nowrap" style={{cursor:"pointer"}} >
          <IconPaperclip size={16} />
          <Text size="sm">{files.length}</Text>
        </Group>
      );
    case 'comments':
      return (
        <Group gap={4} justify="center" wrap="nowrap" style={{cursor:"pointer"}} >
          <IconMessage size={16} />
          <Text size="sm">{comments.length}</Text>
        </Group>
      );
    case 'source_file':
      return (
        <Text size="sm" lineClamp={2} title={document.source_invoice_no ?? ''}>
          {document.source_invoice_id ? document.source_invoice_no || 'Счёт' : '—'}
        </Text>
      );
    default:
      return null;
  }
}

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
  const totalWidth = columns.reduce(
    (sum, column) => sum + getDocumentColumnWidth(column, sizing),
    0,
  );

  return (
    <Stack gap="md">
      {groups.map((group) => {
        const isCollapsed = collapsedIds.has(group.objectId);
        const totalPages = Math.max(1, Math.ceil(group.total / pageSize));
        return (
          <Paper key={group.objectId} withBorder p="sm" style={{ borderLeft: '3px solid var(--org-color, #228be6)' }}>
            <Group
              justify="space-between"
              mb="xs"
              wrap="nowrap"
              onClick={() => onToggleCollapse(group.objectId)}
              style={{ cursor: 'pointer' }}
            >
              <Group gap="xs" wrap="nowrap">
                {isCollapsed ? <IconChevronRight size={16} /> : <IconChevronDown size={16} />}
                <Title order={5}>{group.objectName}</Title>
              </Group>
              <Text size="sm" c="dimmed">
                {group.total}
              </Text>
            </Group>
            {!isCollapsed && (
              <>
                <Box visibleFrom="sm">
                  <ScrollArea type="auto" offsetScrollbars>
                  <Table
                    // striped
                    highlightOnHover
                    withTableBorder
                    withColumnBorders
                    style={{ minWidth: totalWidth, tableLayout: 'fixed' }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        {columns.map((column) => (
                          <ResizableHeader
                            key={column.id}
                            columnId={column.id}
                            label={column.label}
                            width={getDocumentColumnWidth(column, sizing)}
                            align={column.align}
                            onWidthChange={onWidthChange}
                            onWidthCommit={onWidthCommit}
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
                        group.documents.map((document) => {
                          const completed = isDocumentCompleted(document);
                          return (
                            <Table.Tr
                              key={document.id}
                              ref={
                                highlightDocumentId && document.id === highlightDocumentId
                                  ? highlightRowRef
                                  : null
                              }
                              className={
                                highlightDocumentId && document.id === highlightDocumentId
                                  ? 'document-row--highlight'
                                  : undefined
                              }
                              style={{
                                backgroundColor: completed
                                  ? 'var(--mantine-color-gray-1)'
                                  : undefined,
                                color: completed ? 'var(--mantine-color-dimmed)' : undefined,
                              }}
                              data-document-id={document.id}
                            >
                              {columns.map((column) => (
                                <Table.Td
                                  key={column.id}
                                  style={{ textAlign: column.align ?? 'left' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const tab =
                                      column.id === 'files'
                                        ? 'files'
                                        : column.id === 'comments'
                                          ? 'comments'
                                          : 'document';
                                    onOpenDocument(document, tab);
                                  }}
                                >
                                  {renderCell(
                                    column.id,
                                    document,
                                    filesByDocument[document.id] ?? [],
                                    commentsByDocument[document.id] ?? [],
                                  )}
                                </Table.Td>
                              ))}
                            </Table.Tr>
                          );
                        })
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
                </Box>

                <Stack hiddenFrom="sm" gap="sm">
                  <DocumentMobileCards
                    documents={group.documents}
                    visibleColumns={visibleColumns}
                    filesByDocument={filesByDocument}
                    commentsByDocument={commentsByDocument}
                    onOpenDocument={onOpenDocument}
                    highlightDocumentId={highlightDocumentId}
                  />
                </Stack>

                {group.total > pageSize && (
                  <Group justify="center" mt="sm">
                    <Pagination
                      size="sm"
                      total={totalPages}
                      value={group.page}
                      onChange={(page) => onPageChange(group.objectId, page)}
                    />
                  </Group>
                )}
              </>
            )}
          </Paper>
        );
      })}
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
