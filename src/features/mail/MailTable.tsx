import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Box, Group, Loader, Pagination, Table, Text, Tooltip } from '@mantine/core';
import { IconLink, IconMailOff } from '@tabler/icons-react';
import type { MailType } from '@/shared/types';
import { MAIL_DELIVERY_METHOD_EMOJI, MAIL_DELIVERY_METHOD_NAMES } from '@/shared/types';
import { getOrderedColumns } from './mail-columns';
import type { MailColumn, MailColumnId } from './mail-columns';
import {
  clampShare,
  loadColumnSizing,
  resolveColumnShares,
  saveColumnSizing,
} from './mail-table-column-sizing';
import type { ColumnSizingState } from './mail-table-column-sizing';
import { MailActionsMenu } from './MailActionsMenu';
import { MailAttachmentIndicator } from './MailAttachmentIndicator';
import { MailFiltersReset } from './MailFilters';
import { MailMobileCards } from './MailMobileCards';
import { formatMailDate, formatMailTimestamp } from './mail-date';
import type { MailRow } from './mail-row';
import {
  MAIL_EMPTY_CELL,
  MAIL_NO_ACCOUNTING_OBJECT_LABEL,
  MAIL_NO_DELIVERY_METHOD_LABEL,
} from './mail-labels';
import type { MailPermissions } from './mail-field-access';

interface MailTableProps {
  orgId: string;
  mailType: MailType;
  rows: MailRow[];
  visibleColumns: MailColumnId[];
  loading: boolean;
  objectNames: Map<string, string>;
  permissions: MailPermissions;
  page: number;
  pageCount: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onOpenFiles: (mailId: string) => void;
  onEdit: (mailId: string) => void;
  onDelete: (mailId: string) => void;
  onHistory: (mailId: string) => void;
  onRelations: (mailId: string) => void;
  onResetFilters: () => void;
  hasFilters: boolean;
  emptyHint: string;
  highlightedMailId?: string | null;
}

/** Узкая колонка всё ещё должна читаться: меньше — уже не буква, а полоса. */
const MIN_COLUMN_WIDTH_PX = 50;

const RESIZE_HANDLE_STYLE = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 10,
  cursor: 'col-resize',
  userSelect: 'none',
  borderRight: '1px solid var(--mantine-color-gray-3)',
} as const;

const TH_STYLE = {
  position: 'sticky',
  top: 56,
  zIndex: 1,
  backgroundColor: 'var(--mantine-color-body)',
  overflow: 'hidden',
} as const;

/**
 * `table-layout: fixed` не ужимает содержимое ячейки: колонку, сжатую
 * перетаскиванием соседней, «30.09.2026» выступил бы прямо на «01/2026».
 * Заголовок обрезается по `overflow: hidden` — ячейка обязана вести себя так же,
 * иначе переполнение появляется именно там, где пользователь ширину настроил.
 */
const TD_STYLE = { overflow: 'hidden' } as const;

function Cell({
  id,
  row,
  objectNames,
  onOpenFiles,
  onRelations,
  actions,
}: {
  id: MailColumnId;
  row: MailRow;
  objectNames: Map<string, string>;
  onOpenFiles: (mailId: string) => void;
  onRelations: (mailId: string) => void;
  actions: React.ReactNode;
}) {
  switch (id) {
    case 'seq':
      return <Text size="sm">{row.seq ?? MAIL_EMPTY_CELL}</Text>;
    case 'date':
      return (
        <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
          {formatMailDate(row.dateKey)}
        </Text>
      );
    case 'number':
      return <Text size="sm">{row.number || MAIL_EMPTY_CELL}</Text>;
    case 'counterparty':
      return (
        <Text size="sm" lineClamp={2} fw={600}>
          {row.counterparty}
        </Text>
      );
    case 'counterparty_number':
      return <Text size="sm">{row.counterpartyNumber || MAIL_EMPTY_CELL}</Text>;
    case 'subject':
      return (
        <Text size="sm" lineClamp={2} title={row.comment || row.subject}>
          {row.subject}
        </Text>
      );
    case 'responsible_name':
      return (
        <Text size="sm" lineClamp={2}>
          {row.responsibleName || MAIL_EMPTY_CELL}
        </Text>
      );
    case 'delivery_method':
      return row.deliveryMethod ? (
        <Text
          size="xl"
          role="img"
          aria-label={MAIL_DELIVERY_METHOD_NAMES[row.deliveryMethod]}
          title={MAIL_DELIVERY_METHOD_NAMES[row.deliveryMethod]}
          style={{ whiteSpace: 'nowrap' }}
        >
          {MAIL_DELIVERY_METHOD_EMOJI[row.deliveryMethod]}
        </Text>
      ) : (
        <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {MAIL_NO_DELIVERY_METHOD_LABEL}
        </Text>
      );
    case 'accounting_object_id':
      return row.accountingObjectId ? (
        <Text size="sm" lineClamp={2}>
          {objectNames.get(row.accountingObjectId) ?? MAIL_EMPTY_CELL}
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          {MAIL_NO_ACCOUNTING_OBJECT_LABEL}
        </Text>
      );
    case 'files':
      return (
        <MailAttachmentIndicator
          row={row}
          ariaLabel={`Вложения письма ${row.number || row.id}`}
          onOpenFiles={onOpenFiles}
        />
      );
    case 'created':
      return row.created ? (
        <>
          <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
            {formatMailDate(row.created)}, {formatMailTimestamp(row.created).slice(-5)}
          </Text>
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {row.createdByName ? ` ${row.createdByName}` : ''}
          </Text>
        </>
      ) : (
        <Text size="sm">{MAIL_EMPTY_CELL}</Text>
      );
    case 'thread':
      return (
        <Tooltip label="Переписка">
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            aria-label={`Переписка письма ${row.number || row.id}`}
            onClick={() => onRelations(row.id)}
          >
            <IconLink size={16} />
          </ActionIcon>
        </Tooltip>
      );
    case 'actions':
      return actions;
  }
}

/**
 * Реестр писем. Десктоп — `Table` с фиксированной раскладкой и липкой шапкой,
 * мобильный — карточки, как в `GroupedInvoiceTable`/`InvoiceMobileCardView`:
 * горизонтальной прокрутки таблицы на телефоне нет ни в одной ветке.
 *
 * Колонки приходят из `visibleColumns` — то есть в порядке, который пользователь
 * задал в настройке и который уже пересечён с правами, — и занимают доли ширины
 * от `resolveColumnShares`, а не захардкоженные проценты. Сумма долей ровно 100%,
 * поэтому смешанная раскладка не может вытолкнуть таблицу за пределы `Paper`.
 */
export function MailTable({
  orgId,
  mailType,
  rows,
  visibleColumns,
  loading,
  objectNames,
  permissions,
  page,
  pageCount,
  totalItems,
  onPageChange,
  onOpenFiles,
  onEdit,
  onDelete,
  onHistory,
  onRelations,
  onResetFilters,
  hasFilters,
  emptyHint,
  highlightedMailId,
}: MailTableProps) {
  const columns = getOrderedColumns(visibleColumns, mailType);
  const columnIds = visibleColumns;

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

  const handleResizeStart = (colId: MailColumnId, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const tableWidth = tableRef.current?.getBoundingClientRect().width ?? 0;
    if (tableWidth <= 0) return;
    resizingRef.current = {
      colId,
      startX: e.clientX,
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

  return (
    <>
      <Box visibleFrom="sm" ref={tableRef}>
        <Table highlightOnHover style={{ width: '100%', maxWidth: '100%', tableLayout: 'fixed' }}>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column: MailColumn) => (
                <Table.Th
                  key={column.id}
                  style={{ ...TH_STYLE, width: `${shares.get(column.id) ?? 0}%` }}
                >
                  <div style={{ overflow: 'hidden', maxWidth: '100%' }}>{column.header}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(column.id, e)}
                    className="col-resize-handle"
                    style={RESIZE_HANDLE_STYLE}
                  />
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
{rows.map((row) => (
                <Table.Tr key={row.id} data-highlight-id={row.id}>
                {columns.map((column) => (
                  <Table.Td key={column.id} style={TD_STYLE}>
                    <Cell
                      id={column.id}
                      row={row}
                      objectNames={objectNames}
                      onOpenFiles={onOpenFiles}
                      onRelations={onRelations}
                      actions={
                        column.id === 'actions' ? (
                          <MailActionsMenu
                            mailId={row.id}
                            mailType={mailType}
                            permissions={permissions}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onHistory={onHistory}
                          />
                        ) : null
                      }
                    />
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
            {rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <Box ta="center" py="xl">
                    {loading ? (
                      <>
                        <Loader size="sm" />
                        <Text c="dimmed" mt="xs">
                          Загрузка писем…
                        </Text>
                      </>
                    ) : (
                      <>
                        <IconMailOff
                          size={36}
                          stroke={1.5}
                          style={{ color: 'var(--mantine-color-gray-5)' }}
                        />
                        <Text c="dimmed" mt="xs">
                          {emptyHint}
                        </Text>
                        {hasFilters && <MailFiltersReset onReset={onResetFilters} />}
                      </>
                    )}
                  </Box>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>

      <MailMobileCards
        rows={rows}
        loading={loading}
        objectNames={objectNames}
        emptyHint={emptyHint}
        hasFilters={hasFilters}
        onResetFilters={onResetFilters}
        onOpenFiles={onOpenFiles}
        mailType={mailType}
        permissions={permissions}
        visibleColumns={visibleColumns}
        onEdit={onEdit}
        onDelete={onDelete}
        onHistory={onHistory}
        onRelations={onRelations}
        highlightedMailId={highlightedMailId}
      />

      {pageCount > 1 && (
        <Group justify="center" mt="md">
          <Text size="xs" c="dimmed" mr="sm">
            {`Всего: ${totalItems}`}
          </Text>
          <Pagination value={page} onChange={onPageChange} total={pageCount} size="sm" withEdges />
        </Group>
      )}
    </>
  );
}
