import { useState, useMemo, useEffect } from 'react';
import { Table, Text, Badge, Box, ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import { IconX, IconGripVertical, IconInbox, IconPlus } from '@tabler/icons-react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import type { IInvoice, IInvoiceFile, IPaymentMark, InvoiceColumnId } from '@/shared/types';
import { useUserMap } from '@/shared/hooks/useUserMap';
import { useAutoScrollIntoView } from '@/shared/hooks/useAutoScrollIntoView';
import { formatAmountRub } from '@/shared/utils/format-currency';
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
import { markRowColor } from './payment-mark-row-style';
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
                  const BORDER =
                    '3.5px solid var(--org-color, var(--mantine-primary-color-filled))';
                  return (
                    <SortableGroupBody key={group.counterparty} id={group.counterparty}>
                      {({ listeners, isOver }) =>
                        group.invoices.flatMap((invoice, idx) => {
                          const getExpandedCount = (inv: IInvoice) => {
                            const amts = inv.payment_amounts ?? [];
                            const tPaid = amts.reduce((s, a) => s + a, 0);
                            let extra = 0;
                            if (amts.length > 1) extra += amts.length - 1;
                            if (tPaid > 0 && inv.amount - tPaid > 0) extra += 1;
                            return 1 + extra;
                          };

                          const precedingRows = group.invoices
                            .slice(0, idx)
                            .reduce((sum, inv) => sum + getExpandedCount(inv), 0);
                          const followingRows = group.invoices
                            .slice(idx + 1)
                            .reduce((sum, inv) => sum + getExpandedCount(inv), 0);
                          const isGroupFirst = precedingRows === 0;
                          const isGroupLast = followingRows === 0;

                          const invoiceNumber = getInvoiceNumber(groups, invoice.id);
                          const showCounterparty = idx === counterpartyRowIndex - 1;
                          const paid = invoice.paid;
                          const isHighlighted = highlightedIds.includes(invoice.id);
                          const markLookupId = invoice.id.endsWith('__r')
                            ? invoice.id.slice(0, -3)
                            : invoice.id;
                          const mark = marksByInvoice[markLookupId];

                          const isNumHandle = true;
                          const isCpHandle = showCounterparty;

                          const amounts = invoice.payment_amounts ?? [];
                          const totalPaid = amounts.reduce((s, a) => s + a, 0);
                          const remaining = invoice.amount - totalPaid;

                          const hasCopies = amounts.length > 1;
                          const hasRemainder = !paid && totalPaid > 0 && remaining > 0;
                          const extraRows =
                            (hasCopies ? amounts.length - 1 : 0) + (hasRemainder ? 1 : 0);
                          const isLastRow = isGroupLast && extraRows === 0;

                          const rowStyle: React.CSSProperties = {
                            borderLeft: BORDER,
                            borderRight: BORDER,
                            ...(isGroupFirst ? { borderTop: BORDER } : {}),
                            ...(isLastRow ? { borderBottom: BORDER } : {}),
                            ...(paid
                              ? { backgroundColor: 'var(--mantine-color-green-1)' }
                              : mark
                                ? { backgroundColor: markRowColor(mark, invoice.amount) }
                                : isHighlighted
                                  ? {
                                      backgroundColor:
                                        'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)',
                                    }
                                  : {}),
                            ...(isOver && isGroupFirst
                              ? { borderTop: '3px solid var(--mantine-color-blue-6)' }
                              : {}),
                          };

                          const rows: React.ReactNode[] = [];

                          // 1. Original row
                          rows.push(
                            <Table.Tr
                              key={invoice.id}
                              style={rowStyle}
                              data-highlight-id={isHighlighted ? invoice.id : undefined}
                            >
                              <Table.Td
                                {...(isNumHandle ? listeners : {})}
                                style={{
                                  cursor: isNumHandle ? 'grab' : undefined,
                                  overflow: 'hidden',
                                  maxWidth: '100%',
                                }}
                              >
                                <div
                                  style={{
                                    overflow: 'hidden',
                                    maxWidth: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                  }}
                                >
                                  <IconGripVertical
                                    size={12}
                                    className="row-grip-icon"
                                    style={{ flexShrink: 0, color: 'var(--mantine-color-gray-5)' }}
                                  />
                                  {invoiceNumber})
                                </div>
                              </Table.Td>
                              {filteredColumns.map((colId) => {
                                const col = columnRenderers[colId];
                                const width = columnSizing[colId] ?? col.width;
                                const isThisCpHandle = isCpHandle && colId === 'counterparty';
                                return (
                                  <Table.Td
                                    key={colId}
                                    {...(isThisCpHandle ? listeners : {})}
                                    style={{
                                      width,
                                      cursor: isThisCpHandle ? 'grab' : undefined,
                                    }}
                                  >
                                    <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                                      {colId === 'counterparty' && showCounterparty ? (
                                        <>
                                          <Text fw={600}>{group.counterparty}</Text>
                                          {group.invoices.length > 1 && (
                                            <Text size="xs" c="dimmed">
                                              Итого:{' '}
                                              {formatAmountRub(
                                                group.invoices
                                                  .filter((inv) => !inv.paid)
                                                  .reduce((sum, inv) => sum + inv.amount, 0),
                                              )}
                                            </Text>
                                          )}
                                        </>
                                      ) : colId === 'counterparty' ? null : (
                                        col.renderCell(invoice)
                                      )}
                                    </div>
                                  </Table.Td>
                                );
                              })}
                            </Table.Tr>,
                          );

                          // 2. Copy rows for payment_amounts[1..n]
                          if (amounts.length > 1) {
                            for (let i = 1; i < amounts.length; i++) {
                              const copyAmt = amounts[i]!;
                              const isLastCopy = i === amounts.length - 1;
                              const copyId = `${invoice.id}__p${i - 1}`;
                              const suffix = `__p${i - 1}`;
                              rows.push(
                                <Table.Tr
                                  key={copyId}
                                  style={{
                                    borderLeft: BORDER,
                                    borderRight: BORDER,
                                    ...(isGroupLast && !hasRemainder && i === amounts.length - 1
                                      ? { borderBottom: BORDER }
                                      : {}),
                                    backgroundColor: 'var(--mantine-color-green-1)',
                                    fontSize: '0.9em',
                                  }}
                                >
                                  <Table.Td
                                    style={{
                                      overflow: 'hidden',
                                      maxWidth: '100%',
                                      color: 'var(--mantine-color-dimmed)',
                                    }}
                                  >
                                    <div style={{ overflow: 'hidden', maxWidth: '100%' }} />
                                  </Table.Td>
                                  {filteredColumns.map((colId) => {
                                    const col = columnRenderers[colId];
                                    const width = columnSizing[colId] ?? col.width;
                                    return (
                                      <Table.Td key={colId} style={{ width }}>
                                        <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                                          {colId === 'counterparty' ? null : colId === 'paid' ? (
                                            <Group gap={2} wrap="nowrap">
                                              <Badge color="green" variant="light">
                                                {formatAmountRub(copyAmt)}
                                              </Badge>
                                              {isLastCopy && (
                                                <Tooltip label="Снять оплату">
                                                  <ActionIcon
                                                    size="md"
                                                    color="red"
                                                    variant="subtle"
                                                    aria-label="Снять оплату"
                                                    onClick={() => setClearConfirmInvoiceId(copyId)}
                                                  >
                                                    <IconX size={14} />
                                                  </ActionIcon>
                                                </Tooltip>
                                              )}
                                            </Group>
                                          ) : colId === 'purpose' ? (
                                            <Text size="xs" c="dimmed" fs="italic">
                                              {invoice.purpose}
                                            </Text>
                                          ) : (
                                            col.renderCell({
                                              ...invoice,
                                              id: copyId,
                                              comment:
                                                invoice.copy_comments?.[suffix] ?? invoice.comment,
                                              amount: copyAmt,
                                              paid: true,
                                              paid_amount: null,
                                              payment_amounts: [],
                                              paid_date: invoice.paid_date,
                                            })
                                          )}
                                        </div>
                                      </Table.Td>
                                    );
                                  })}
                                </Table.Tr>,
                              );
                            }
                          }

                          // 3. Remainder row
                          if (!paid && totalPaid > 0 && remaining > 0) {
                            const remainderId = `${invoice.id}__r`;
                            const remainderInvoice: IInvoice = {
                              ...invoice,
                              id: remainderId,
                              amount: remaining,
                              paid: false,
                              paid_amount: null,
                              payment_amounts: [],
                              paid_date: null as unknown as string,
                            };
                            rows.push(
                              <Table.Tr
                                key={remainderId}
                                style={{
                                  borderLeft: BORDER,
                                  borderRight: BORDER,
                                  ...(isGroupLast ? { borderBottom: BORDER } : {}),
                                  backgroundColor: 'var(--mantine-color-gray-0)',
                                  fontSize: '0.9em',
                                }}
                              >
                                <Table.Td
                                  style={{
                                    overflow: 'hidden',
                                    maxWidth: '100%',
                                  }}
                                >
                                  <div
                                    style={{
                                      overflow: 'hidden',
                                      maxWidth: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 2,
                                    }}
                                  >
                                    <IconGripVertical
                                      size={12}
                                      className="row-grip-icon"
                                      style={{
                                        flexShrink: 0,
                                        color: 'var(--mantine-color-gray-5)',
                                      }}
                                    />
                                    {invoiceNumber})
                                  </div>
                                </Table.Td>
                                {filteredColumns.map((colId) => {
                                  const col = columnRenderers[colId];
                                  const width = columnSizing[colId] ?? col.width;
                                  return (
                                    <Table.Td key={colId} style={{ width }}>
                                      <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                                        {colId === 'counterparty' ? null : colId === 'amount' ? (
                                          <Text size="xs">
                                            <Text component="span" fw={700}>
                                              Остаток:
                                            </Text>{' '}
                                            {formatAmountRub(remaining)}
                                          </Text>
                                        ) : colId === 'purpose' ? (
                                          <Text size="xs" c="dimmed" fs="italic">
                                            {invoice.purpose}
                                          </Text>
                                        ) : (
                                          col.renderCell({
                                            ...remainderInvoice,
                                            comment:
                                              invoice.copy_comments?.['__r'] ?? invoice.comment,
                                          })
                                        )}
                                      </div>
                                    </Table.Td>
                                  );
                                })}
                              </Table.Tr>,
                            );
                          }

                          return rows;
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
                  const BORDER =
                    '3.5px solid var(--org-color, var(--mantine-primary-color-filled))';
                  return (
                    <StaticGroupBody key={group.counterparty}>
                      {() =>
                        group.invoices.flatMap((invoice, idx) => {
                          const getExpandedCount = (inv: IInvoice) => {
                            const amts = inv.payment_amounts ?? [];
                            const tPaid = amts.reduce((s, a) => s + a, 0);
                            let extra = 0;
                            if (amts.length > 1) extra += amts.length - 1;
                            if (tPaid > 0 && inv.amount - tPaid > 0) extra += 1;
                            return 1 + extra;
                          };

                          const precedingRows = group.invoices
                            .slice(0, idx)
                            .reduce((sum, inv) => sum + getExpandedCount(inv), 0);
                          const followingRows = group.invoices
                            .slice(idx + 1)
                            .reduce((sum, inv) => sum + getExpandedCount(inv), 0);
                          const isGroupFirst = precedingRows === 0;
                          const isGroupLast = followingRows === 0;

                          const invoiceNumber = getInvoiceNumber(groups, invoice.id);
                          const showCounterparty = idx === counterpartyRowIndex - 1;
                          const paid = invoice.paid;
                          const isHighlighted = highlightedIds.includes(invoice.id);
                          const markLookupId = invoice.id.endsWith('__r')
                            ? invoice.id.slice(0, -3)
                            : invoice.id;
                          const mark = marksByInvoice[markLookupId];

                          const amounts = invoice.payment_amounts ?? [];
                          const totalPaid = amounts.reduce((s, a) => s + a, 0);
                          const remaining = invoice.amount - totalPaid;

                          const hasCopies = amounts.length > 1;
                          const hasRemainder = !paid && totalPaid > 0 && remaining > 0;
                          const extraRows =
                            (hasCopies ? amounts.length - 1 : 0) + (hasRemainder ? 1 : 0);
                          const isLastRow = isGroupLast && extraRows === 0;

                          const rowStyle: React.CSSProperties = {
                            borderLeft: BORDER,
                            borderRight: BORDER,
                            ...(isGroupFirst ? { borderTop: BORDER } : {}),
                            ...(isLastRow ? { borderBottom: BORDER } : {}),
                            ...(paid
                              ? { backgroundColor: 'var(--mantine-color-green-1)' }
                              : mark
                                ? { backgroundColor: markRowColor(mark, invoice.amount) }
                                : isHighlighted
                                  ? {
                                      backgroundColor:
                                        'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)',
                                    }
                                  : {}),
                          };

                          const rows: React.ReactNode[] = [];

                          // 1. Original row
                          rows.push(
                            <Table.Tr key={invoice.id} style={rowStyle}>
                              <Table.Td
                                style={{
                                  overflow: 'hidden',
                                  maxWidth: '100%',
                                }}
                              >
                                <div
                                  style={{
                                    overflow: 'hidden',
                                    maxWidth: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                  }}
                                >
                                  {invoiceNumber})
                                </div>
                              </Table.Td>
                              {filteredColumns.map((colId) => {
                                const col = columnRenderers[colId];
                                const width = columnSizing[colId] ?? col.width;
                                return (
                                  <Table.Td
                                    key={colId}
                                    style={{
                                      width,
                                    }}
                                  >
                                    <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                                      {colId === 'counterparty' && showCounterparty ? (
                                        <>
                                          <Text fw={600}>{group.counterparty}</Text>
                                          {group.invoices.length > 1 && (
                                            <Text size="xs" c="dimmed">
                                              Итого:{' '}
                                              {formatAmountRub(
                                                group.invoices
                                                  .filter((inv) => !inv.paid)
                                                  .reduce((sum, inv) => sum + inv.amount, 0),
                                              )}
                                            </Text>
                                          )}
                                        </>
                                      ) : colId === 'counterparty' ? null : (
                                        col.renderCell(invoice)
                                      )}
                                    </div>
                                  </Table.Td>
                                );
                              })}
                            </Table.Tr>,
                          );

                          // 2. Copy rows for payment_amounts[1..n]
                          if (amounts.length > 1) {
                            for (let i = 1; i < amounts.length; i++) {
                              const copyAmt = amounts[i]!;
                              const copyId = `${invoice.id}__p${i - 1}`;
                              const suffix = `__p${i - 1}`;
                              rows.push(
                                <Table.Tr
                                  key={copyId}
                                  style={{
                                    borderLeft: BORDER,
                                    borderRight: BORDER,
                                    ...(isGroupLast && !hasRemainder && i === amounts.length - 1
                                      ? { borderBottom: BORDER }
                                      : {}),
                                    backgroundColor: 'var(--mantine-color-green-1)',
                                    fontSize: '0.9em',
                                  }}
                                >
                                  <Table.Td
                                    style={{
                                      overflow: 'hidden',
                                      maxWidth: '100%',
                                      color: 'var(--mantine-color-dimmed)',
                                    }}
                                  >
                                    <div style={{ overflow: 'hidden', maxWidth: '100%' }} />
                                  </Table.Td>
                                  {filteredColumns.map((colId) => {
                                    const col = columnRenderers[colId];
                                    const width = columnSizing[colId] ?? col.width;
                                    return (
                                      <Table.Td key={colId} style={{ width }}>
                                        <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                                          {colId === 'counterparty' ? null : colId === 'paid' ? (
                                            <Badge color="green" variant="light">
                                              {formatAmountRub(copyAmt)}
                                            </Badge>
                                          ) : colId === 'purpose' ? (
                                            <Text size="xs" c="dimmed" fs="italic">
                                              {invoice.purpose}
                                            </Text>
                                          ) : (
                                            col.renderCell({
                                              ...invoice,
                                              id: copyId,
                                              comment:
                                                invoice.copy_comments?.[suffix] ?? invoice.comment,
                                              amount: copyAmt,
                                              paid: true,
                                              paid_amount: null,
                                              payment_amounts: [],
                                              paid_date: invoice.paid_date,
                                            })
                                          )}
                                        </div>
                                      </Table.Td>
                                    );
                                  })}
                                </Table.Tr>,
                              );
                            }
                          }

                          // 3. Remainder row
                          if (!paid && totalPaid > 0 && remaining > 0) {
                            const remainderId = `${invoice.id}__r`;
                            const remainderInvoice: IInvoice = {
                              ...invoice,
                              id: remainderId,
                              amount: remaining,
                              paid: false,
                              paid_amount: null,
                              payment_amounts: [],
                              paid_date: null as unknown as string,
                            };
                            rows.push(
                              <Table.Tr
                                key={remainderId}
                                style={{
                                  borderLeft: BORDER,
                                  borderRight: BORDER,
                                  ...(isGroupLast ? { borderBottom: BORDER } : {}),
                                  backgroundColor: 'var(--mantine-color-gray-0)',
                                  fontSize: '0.9em',
                                }}
                              >
                                <Table.Td
                                  style={{
                                    overflow: 'hidden',
                                    maxWidth: '100%',
                                  }}
                                >
                                  <div
                                    style={{
                                      overflow: 'hidden',
                                      maxWidth: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 2,
                                    }}
                                  >
                                    <IconGripVertical
                                      size={12}
                                      className="row-grip-icon"
                                      style={{
                                        flexShrink: 0,
                                        color: 'var(--mantine-color-gray-5)',
                                      }}
                                    />
                                    {invoiceNumber})
                                  </div>
                                </Table.Td>
                                {filteredColumns.map((colId) => {
                                  const col = columnRenderers[colId];
                                  const width = columnSizing[colId] ?? col.width;
                                  return (
                                    <Table.Td key={colId} style={{ width }}>
                                      <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                                        {colId === 'counterparty' ? null : colId === 'amount' ? (
                                          <Text size="xs">
                                            <Text component="span" fw={700}>
                                              Остаток:
                                            </Text>{' '}
                                            {formatAmountRub(remaining)}
                                          </Text>
                                        ) : colId === 'purpose' ? (
                                          <Text size="xs" c="dimmed" fs="italic">
                                            {invoice.purpose}
                                          </Text>
                                        ) : (
                                          col.renderCell({
                                            ...remainderInvoice,
                                            comment:
                                              invoice.copy_comments?.['__r'] ?? invoice.comment,
                                          })
                                        )}
                                      </div>
                                    </Table.Td>
                                  );
                                })}
                              </Table.Tr>,
                            );
                          }

                          return rows;
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
