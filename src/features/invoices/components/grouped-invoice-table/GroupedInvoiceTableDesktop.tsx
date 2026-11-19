import type { Ref } from 'react';
import { Table, Box, Button, Group } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { DndContext } from '@dnd-kit/core';
import type { useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import type { IPaymentMark, InvoiceColumnId } from '@/shared/types';
import { getInvoiceNumber, type InvoiceGroup } from '@/shared/utils/group-invoices';
import type { DraftInvoiceForm } from '@/features/invoices/invoice-field-access';
import type { ColumnSizingState } from '@/features/invoices/invoice-table-column-sizing';
import { SortableGroupBody, StaticGroupBody } from './GroupedInvoiceTableGroupBodies';
import { GroupedInvoiceTableDraftRow } from './GroupedInvoiceTableDraftRow';
import { buildInvoiceRows } from './grouped-invoice-table-rows';
import type { useGroupedInvoiceTableDragDrop } from './useGroupedInvoiceTableDragDrop';
import type { GroupedInvoiceTableColumnRenderers } from './column-renderers/types';

const NUM_COLUMN_ID = 'num' as const;
const NUM_COLUMN_DEFAULT_WIDTH = 68;

interface GroupedInvoiceTableDesktopProps {
  groups: InvoiceGroup[];
  canDrag: boolean;
  canCreate: boolean;
  hasDraftElsewhere: boolean;
  isDraftOpen: boolean;
  draftForm?: DraftInvoiceForm;
  draftRowRef: Ref<HTMLTableRowElement>;
  filteredColumns: InvoiceColumnId[];
  columnRenderers: GroupedInvoiceTableColumnRenderers;
  columnSizing: ColumnSizingState;
  handleResizeStart: (colId: string, e: React.MouseEvent, startWidth: number) => void;
  sensors: ReturnType<typeof useSensors>;
  handleDragEnd: ReturnType<typeof useGroupedInvoiceTableDragDrop>['handleDragEnd'];
  marksByInvoice: Record<string, IPaymentMark>;
  highlightedIds: string[];
  onAddClick?: () => void;
  onDraftSave: () => void;
  onDraftCancel: () => void;
  setClearConfirmInvoiceId: (id: string) => void;
}

/**
 * Десктопная таблица: кнопка «Добавить счёт», шапка с ресайзом колонок,
 * перетаскиваемые группы (или статические, если перенос запрещён) и строка
 * черновика. Мобильный вид — отдельной карточкой в `InvoiceMobileCardView`.
 */
export function GroupedInvoiceTableDesktop({
  groups,
  canDrag,
  canCreate,
  hasDraftElsewhere,
  isDraftOpen,
  draftForm,
  draftRowRef,
  filteredColumns,
  columnRenderers,
  columnSizing,
  handleResizeStart,
  sensors,
  handleDragEnd,
  marksByInvoice,
  highlightedIds,
  onAddClick,
  onDraftSave,
  onDraftCancel,
  setClearConfirmInvoiceId,
}: GroupedInvoiceTableDesktopProps) {
  // Таблица целиком видна только с sm-ширины: на узком экране её место
  // занимают мобильные карточки.
  return (
    <Box visibleFrom="sm">
      {canCreate && onAddClick && (
        <Group justify="flex-end" mb="sm">
          <Button
            leftSection={<IconPlus size={16} />}
            disabled={isDraftOpen || hasDraftElsewhere}
            onClick={onAddClick}
          >
            Добавить счёт
          </Button>
        </Group>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <Table
          highlightOnHover
          className="invoices-table"
          style={{ width: '100%', maxWidth: '100%', tableLayout: 'fixed' }}
        >
          {/* Шапка: колонка «№» с ресайзом + видимые колонки с их рендерерами */}
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                style={{
                  width: columnSizing[NUM_COLUMN_ID] ?? NUM_COLUMN_DEFAULT_WIDTH,
                  position: 'sticky',
                  top: 104,
                  zIndex: 1,
                  backgroundColor: 'var(--mantine-color-body)',
                  overflow: 'hidden',
                }}
              >
                №
                <div
                  onMouseDown={(e) =>
                    handleResizeStart(
                      NUM_COLUMN_ID,
                      e,
                      columnSizing[NUM_COLUMN_ID] ?? NUM_COLUMN_DEFAULT_WIDTH,
                    )
                  }
                  className="col-resize-handle"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 10,
                    cursor: 'col-resize',
                    userSelect: 'none',
                    borderRight: '1px solid var(--mantine-color-gray-3)',
                  }}
                />
              </Table.Th>
              {filteredColumns.map((colId) => {
                const col = columnRenderers[colId];
                const width = columnSizing[colId] ?? col.width;
                return (
                  <Table.Th
                    key={colId}
                    style={{
                      width,
                      position: 'sticky',
                      top: 104,
                      zIndex: 1,
                      backgroundColor: 'var(--mantine-color-body)',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ overflow: 'hidden', maxWidth: '100%' }}>{col.header}</div>
                    <div
                      onMouseDown={(e) =>
                        handleResizeStart(colId, e, columnSizing[colId] ?? col.width)
                      }
                      className="col-resize-handle"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 10,
                        cursor: 'col-resize',
                        userSelect: 'none',
                        borderRight: '1px solid var(--mantine-color-gray-3)',
                      }}
                    />
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          {canDrag ? (
            <SortableContext
              items={groups.map((g) => g.counterparty)}
              strategy={verticalListSortingStrategy}
            >
              {groups.map((group) => {
                const counterpartyRowIndex = Math.ceil(group.invoices.length / 2);
                return (
                  <SortableGroupBody key={group.counterparty} id={group.counterparty}>
                    {({ listeners, isOver }) =>
                      group.invoices.flatMap((invoice, idx) => {
                        const markLookupId = invoice.id.endsWith('__r')
                          ? invoice.id.slice(0, -3)
                          : invoice.id;
                        return buildInvoiceRows({
                          invoice,
                          invoiceIndex: idx,
                          groupInvoices: group.invoices,
                          groupCounterparty: group.counterparty,
                          counterpartyRowIndex,
                          invoiceNumber: getInvoiceNumber(groups, invoice.id),
                          filteredColumns,
                          columnRenderers,
                          columnSizing,
                          mark: marksByInvoice[markLookupId],
                          isHighlighted: highlightedIds.includes(invoice.id),
                          draggable: true,
                          listeners: listeners as unknown as Record<string, unknown>,
                          isOver,
                          setClearConfirmInvoiceId: (id) => setClearConfirmInvoiceId(id),
                        });
                      })
                    }
                  </SortableGroupBody>
                );
              })}
              {isDraftOpen && draftForm && (
                <GroupedInvoiceTableDraftRow
                  draftRowRef={draftRowRef}
                  filteredColumns={filteredColumns}
                  columnRenderers={columnRenderers}
                  columnSizing={columnSizing}
                  onSave={onDraftSave}
                  onCancel={onDraftCancel}
                />
              )}
            </SortableContext>
          ) : (
            <>
              {groups.map((group) => {
                const counterpartyRowIndex = Math.ceil(group.invoices.length / 2);
                return (
                  <StaticGroupBody key={group.counterparty}>
                    {() =>
                      group.invoices.flatMap((invoice, idx) => {
                        const markLookupId = invoice.id.endsWith('__r')
                          ? invoice.id.slice(0, -3)
                          : invoice.id;
                        return buildInvoiceRows({
                          invoice,
                          invoiceIndex: idx,
                          groupInvoices: group.invoices,
                          groupCounterparty: group.counterparty,
                          counterpartyRowIndex,
                          invoiceNumber: getInvoiceNumber(groups, invoice.id),
                          filteredColumns,
                          columnRenderers,
                          columnSizing,
                          mark: marksByInvoice[markLookupId],
                          isHighlighted: highlightedIds.includes(invoice.id),
                          draggable: false,
                          setClearConfirmInvoiceId: (id) => setClearConfirmInvoiceId(id),
                        });
                      })
                    }
                  </StaticGroupBody>
                );
              })}
              {isDraftOpen && draftForm && (
                <GroupedInvoiceTableDraftRow
                  draftRowRef={draftRowRef}
                  filteredColumns={filteredColumns}
                  columnRenderers={columnRenderers}
                  columnSizing={columnSizing}
                  onSave={onDraftSave}
                  onCancel={onDraftCancel}
                />
              )}
            </>
          )}
        </Table>
      </DndContext>
    </Box>
  );
}
