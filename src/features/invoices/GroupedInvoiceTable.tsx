import { useState, useMemo, useEffect } from 'react';
import { Table, Text, Box, Button, Group } from '@mantine/core';
import { IconInbox, IconPlus } from '@tabler/icons-react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import type { IInvoice, IInvoiceFile, IPaymentMark, InvoiceColumnId } from '@/shared/types';
import { useUserMap } from '@/shared/hooks/useUserMap';
import { useAutoScrollIntoView } from '@/shared/hooks/useAutoScrollIntoView';
import { groupInvoicesByCounterparty, getInvoiceNumber } from '@/shared/utils/group-invoices';
import type { DraftInvoiceForm, InvoiceEditableField } from './invoice-field-access';
import {
  SortableGroupBody,
  StaticGroupBody,
} from './components/grouped-invoice-table/GroupedInvoiceTableGroupBodies';
import { GroupedInvoiceTableDraftRow } from './components/grouped-invoice-table/GroupedInvoiceTableDraftRow';
import { GroupedInvoiceTableModals } from './components/grouped-invoice-table/GroupedInvoiceTableModals';
import { useGroupedInvoiceTableColumnSizing } from './components/grouped-invoice-table/useGroupedInvoiceTableColumnSizing';
import { useGroupedInvoiceTableDragDrop } from './components/grouped-invoice-table/useGroupedInvoiceTableDragDrop';
import { useGroupedInvoiceTableColumnRenderers } from './components/grouped-invoice-table/useGroupedInvoiceTableColumnRenderers';
import { useGroupedInvoiceTableDraft } from './components/grouped-invoice-table/useGroupedInvoiceTableDraft';
import { buildInvoiceRows } from './components/grouped-invoice-table/grouped-invoice-table-rows';
import { InvoiceMobileCardView } from './components/InvoiceMobileCardView';

const NUM_COLUMN_ID = 'num' as const;
const NUM_COLUMN_DEFAULT_WIDTH = 68;

/** Пропсы таблицы счетов с группировкой по контрагентам. */
interface GroupedInvoiceTableProps {
  orgId: string;
  invoices: IInvoice[];
  isDraftOpen: boolean;
  hasDraftElsewhere?: boolean;
  draftForm?: DraftInvoiceForm;
  counterpartyResults?: string[];
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  onDraftSave?: () => void;
  onDraftCancel?: () => void;
  onEdit: (invoice: IInvoice) => void;
  onCopy?: (invoice: IInvoice) => void;
  onDelete: (invoice: IInvoice) => void;
  onHistory: (invoice: IInvoice) => void;
  onMove: (invoice: IInvoice) => void;
  onPayInvoice: (invoiceId: string, amount: number) => void;
  onClearPayment: (invoiceId: string) => void;
  highlightedIds: string[];
  permissions: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canViewHistory: boolean;
    canMove: boolean;
    canPay: boolean;
    canMarkPayment: boolean;
    canRemoveApprovalMark: boolean;
    canViewPaymentMarks: boolean;
    canViewPaidDate: boolean;
    canManageFiles: boolean;
    canEditField?: (field: InvoiceEditableField) => boolean;
  };
  paymentMarks?: IPaymentMark[];
  onMarkForPayment?: (invoice: IInvoice) => void;
  onMarkForApproval?: (invoice: IInvoice) => void;
  onMarkPartialPayment?: (invoiceId: string, amount: number | undefined, comment: string) => void;
  onClearPaymentMark?: (markId: string) => void;
  onApproveMark?: (markId: string) => void;
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  onFiles?: (invoice: IInvoice) => void;
  visibleColumns: InvoiceColumnId[];
  onReorderGroups?: (counterpartyOrder: string[]) => void;
  onAddClick?: () => void;
  allInvoices?: IInvoice[];
  counterpartyOrder?: string[];
}

/**
 * Таблица счетов, сгруппированных по контрагентам.
 * Рендерит мобильные карточки и десктопную таблицу с перетаскиванием групп,
 * черновиком нового счёта, изменением ширины колонок и модалками оплаты/отметок.
 * Отображение колонок и доступные действия определяются правами пользователя.
 */
export function GroupedInvoiceTable({
  orgId,
  invoices,
  allInvoices,
  counterpartyOrder,
  isDraftOpen,
  hasDraftElsewhere = false,
  draftForm,
  counterpartyResults,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onEdit,
  onCopy,
  onDelete,
  onHistory,
  onMove,
  onPayInvoice,
  onClearPayment,
  highlightedIds,
  permissions,
  paymentMarks,
  onMarkForPayment,
  onMarkForApproval,
  onMarkPartialPayment,
  onClearPaymentMark,
  onApproveMark,
  filesByInvoice,
  onFiles,
  visibleColumns,
  onReorderGroups,
  onAddClick,
}: GroupedInvoiceTableProps) {
  const userMap = useUserMap();
  const groups = useMemo(
    () => groupInvoicesByCounterparty(invoices, allInvoices, counterpartyOrder),
    [invoices, allInvoices, counterpartyOrder],
  );
  const canDrag = permissions.canMove;

  const draftRowRef = useAutoScrollIntoView<HTMLTableRowElement>({
    enabled: isDraftOpen && !!draftForm,
  });

  const marksByInvoice = useMemo(() => {
    const map: Record<string, IPaymentMark> = {};
    if (paymentMarks) {
      paymentMarks.forEach((mark) => {
        map[mark.invoice_id] = mark;
      });
    }
    return map;
  }, [paymentMarks]);

  const [partialModal, setPartialModal] = useState<{
    invoice: IInvoice;
    amount: string;
    comment: string;
  } | null>(null);
  const [payModalInvoice, setPayModalInvoice] = useState<IInvoice | null>(null);
  const [payModalAmount, setPayModalAmount] = useState<string>('');
  const [clearConfirmInvoiceId, setClearConfirmInvoiceId] = useState<string | null>(null);

  const {
    draftErrors,
    setDraftErrors,
    discardConfirmOpen,
    setDiscardConfirmOpen,
    amountFocused,
    setAmountFocused,
    amountDisplay,
    setAmountDisplay,
    requestDraftCancel,
    handleDraftSaveClick,
    handleDraftChange,
    handleDraftKeyDown,
  } = useGroupedInvoiceTableDraft({
    draftForm,
    onDraftChange,
    onDraftSave,
    onDraftCancel,
  });

  const filteredColumns = useMemo(
    () =>
      visibleColumns.filter((colId) => {
        if (colId === 'payment_mark') return permissions.canViewPaymentMarks;
        if (colId === 'paid_date') return permissions.canViewPaidDate;
        if (colId === 'actions')
          return (
            permissions.canUpdate ||
            permissions.canDelete ||
            permissions.canViewHistory ||
            permissions.canMove ||
            permissions.canManageFiles
          );
        return true;
      }),
    [visibleColumns, permissions],
  );

  const { columnSizing, handleResizeStart } = useGroupedInvoiceTableColumnSizing({ orgId });

  useEffect(() => {
    setAmountDisplay(String(draftForm?.amount ?? 0));
    setAmountFocused(false);
  }, [draftForm, setAmountDisplay, setAmountFocused]);

  const { sensors, handleDragEnd } = useGroupedInvoiceTableDragDrop({ groups, onReorderGroups });

  function handlePaySubmit(invoice: IInvoice, amount: number) {
    if (invoice.id.endsWith('__r')) {
      const parentId = invoice.id.slice(0, -3);
      onPayInvoice(parentId, amount);
    } else {
      onPayInvoice(invoice.id, amount);
    }
  }

  const columnRenderers = useGroupedInvoiceTableColumnRenderers({
    draftForm,
    draftErrors,
    amountFocused,
    amountDisplay,
    counterpartyResults,
    permissions,
    marksByInvoice,
    filesByInvoice,
    userMap,
    onEdit,
    onCopy,
    onDelete,
    onHistory,
    onMove,
    onFiles,
    onMarkForPayment,
    onMarkForApproval,
    onClearPaymentMark,
    onApproveMark,
    onDraftChange,
    handleDraftChange,
    handleDraftKeyDown,
    setAmountDisplay,
    setAmountFocused,
    setDraftErrors,
    setPayModalInvoice,
    setPayModalAmount,
    setClearConfirmInvoiceId,
    setPartialModal,
  });

  if (groups.length === 0 && !isDraftOpen) {
    return (
      <Box ta="center" py="xl">
        <IconInbox size={36} stroke={1.5} style={{ color: 'var(--mantine-color-gray-5)' }} />
        <Text c="dimmed" mt="xs">
          Нет счетов на эту дату
        </Text>
        {permissions.canCreate && onAddClick && (
          <Button variant="light" size="compact-sm" mt="sm" onClick={onAddClick}>
            Добавить счёт
          </Button>
        )}
      </Box>
    );
  }

  return (
    <>
      {/* Мобильное представление: карточки счетов вместо таблицы */}
      <InvoiceMobileCardView
        invoices={invoices}
        allInvoices={allInvoices}
        counterpartyOrder={counterpartyOrder}
        marksByInvoice={marksByInvoice}
        filesByInvoice={filesByInvoice}
        highlightedIds={highlightedIds}
        permissions={permissions}
        isDraftOpen={isDraftOpen}
        draftForm={draftForm}
        counterpartyResults={counterpartyResults}
        onDraftChange={onDraftChange}
        onDraftSave={onDraftSave}
        onDraftCancel={onDraftCancel}
        onMarkForPayment={onMarkForPayment}
        onMarkForApproval={onMarkForApproval}
        onClearPaymentMark={onClearPaymentMark}
        onApproveMark={onApproveMark}
        onClearPaymentConfirm={(id) => setClearConfirmInvoiceId(id)}
        onOpenPartialModal={(inv) => setPartialModal({ invoice: inv, amount: '', comment: '' })}
        onDelete={onDelete}
      />

      {/* Десктопная таблица: группы контрагентов, черновик и перетаскивание */}
      <Box visibleFrom="sm">
        {permissions.canCreate && onAddClick && (
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
                    onSave={handleDraftSaveClick}
                    onCancel={requestDraftCancel}
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
                    onSave={handleDraftSaveClick}
                    onCancel={requestDraftCancel}
                  />
                )}
              </>
            )}
          </Table>
        </DndContext>
      </Box>

      {/* Модальные окна: оплата, частичная отметка и подтверждения */}
      <GroupedInvoiceTableModals
        payModalInvoice={payModalInvoice}
        payModalAmount={payModalAmount}
        onPayModalClose={() => {
          setPayModalInvoice(null);
          setPayModalAmount('');
        }}
        onPayModalAmountChange={(v) => setPayModalAmount(v)}
        onPaySubmit={handlePaySubmit}
        partialModal={partialModal}
        onPartialModalClose={() => setPartialModal(null)}
        onPartialAmountChange={(v) =>
          setPartialModal((prev) => (prev ? { ...prev, amount: v } : null))
        }
        onPartialCommentChange={(v) =>
          setPartialModal((prev) => (prev ? { ...prev, comment: v } : null))
        }
        onPartialSave={onMarkPartialPayment}
        clearConfirmInvoiceId={clearConfirmInvoiceId}
        onClearConfirmClose={() => setClearConfirmInvoiceId(null)}
        onClearPayment={onClearPayment}
        discardConfirmOpen={discardConfirmOpen}
        onDiscardConfirmClose={() => setDiscardConfirmOpen(false)}
        onDiscardConfirm={() => {
          setDiscardConfirmOpen(false);
          setDraftErrors({});
          onDraftCancel?.();
        }}
      />
    </>
  );
}
