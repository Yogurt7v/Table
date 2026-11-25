import { Box, Group, Pagination, Table, Text } from '@mantine/core';
import type { MailType } from '@/shared/types';
import { getOrderedColumns, type MailColumnId } from '@/features/mail/model/mail-columns';
import { MailActionsMenu } from '../actions/MailActionsMenu';
import { MailMobileCards } from '../mobile/MailMobileCards';
import type { MailRow } from '@/features/mail/model/mail-row';
import type { MailPermissions } from '@/features/mail/model/mail-field-access';
import { MailTableCell } from '../mail-table/MailTableCell';
import { MailTableEmptyState } from '../mail-table/MailTableEmptyState';
import { useMailTableColumnResize } from '../mail-table/useMailTableColumnResize';
import { RESIZE_HANDLE_STYLE, TD_STYLE, TH_STYLE } from '../mail-table/mail-table-styles';

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
  onCopy: (mailId: string) => void;
  onDelete: (mailId: string) => void;
  onHistory: (mailId: string) => void;
  onRelations: (mailId: string) => void;
  onResetFilters: () => void;
  hasFilters: boolean;
  emptyHint: string;
  highlightedMailId?: string | null;
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
 *
 * Ширины колонок живут в `useMailTableColumnResize`, ячейка — в `MailTableCell`,
 * пустое состояние — в `MailTableEmptyState`.
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
  onCopy,
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
  const { tableRef, shares, handleResizeStart } = useMailTableColumnResize({
    orgId,
    columnIds,
  });

  return (
    <>
      {/* Десктопная таблица писем */}
      <Box visibleFrom="sm" ref={tableRef}>
        <Table highlightOnHover style={{ width: '100%', maxWidth: '100%', tableLayout: 'fixed' }}>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th
                  key={column.id}
                  style={{ ...TH_STYLE, width: `${shares.get(column.id) ?? 0}%` }}
                >
                  <div
                    style={{
                      overflow: 'hidden',
                      maxWidth: '100%',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {column.header}
                  </div>
                  <div
                    onMouseDown={(event) => handleResizeStart(column.id, event)}
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
                    <MailTableCell
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
                            onCopy={onCopy}
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
                  <MailTableEmptyState
                    loading={loading}
                    emptyHint={emptyHint}
                    hasFilters={hasFilters}
                    onResetFilters={onResetFilters}
                  />
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>

      {/* Мобильные карточки писем */}
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
        onCopy={onCopy}
        onDelete={onDelete}
        onHistory={onHistory}
        onRelations={onRelations}
        highlightedMailId={highlightedMailId}
      />

      {/* Пагинация реестра */}
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
