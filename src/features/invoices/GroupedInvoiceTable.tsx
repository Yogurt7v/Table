import { useState, useMemo, useRef, useEffect, type KeyboardEvent } from 'react';
import dayjs from 'dayjs';
import {
  Autocomplete,
  NumberInput,
  Table,
  Text,
  Badge,
  Box,
  ActionIcon,
  Button,
  Group,
  Tooltip,
  Anchor,
  TextInput,
  FileButton,
  Stack,
} from '@mantine/core';
import { IconX, IconCheck, IconPaperclip, IconGripVertical, IconInbox, IconPlus } from '@tabler/icons-react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { IInvoice, IInvoiceFile, IPaymentMark, InvoiceColumnId } from '@/shared/types';
import { getInvoiceFileUrl } from '@/api/collections';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { useUserMap } from '@/shared/hooks/useUserMap';
import { groupInvoicesByCounterparty, getInvoiceNumber } from '@/shared/utils/group-invoices';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { DraftFieldErrorKey, DraftFieldErrors, DraftInvoiceForm } from './invoice-field-access';
import { isDraftDirty, validateDraftFields } from './invoice-field-access';
import { PaymentMarkCell } from './components/PaymentMarkCell';
import { InvoiceActionsCell } from './components/InvoiceActionsCell';
import { PayModal } from './components/PayModal';
import { PartialPaymentModal } from './components/PartialPaymentModal';
import { InvoiceMobileCardView } from './components/InvoiceMobileCardView';
import {
  loadColumnSizing,
  saveColumnSizing,
  type ColumnSizingState,
} from './invoice-table-column-sizing';


function shortenFileName(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) {
    return name.length > 5 ? '...' + name.slice(-5) : name;
  }
  const extension = name.slice(dotIndex);
  const baseName = name.slice(0, dotIndex);
  if (baseName.length <= 5) return name;
  return '...' + baseName.slice(-5) + extension;
}

function SortableGroupBody({
  id,
  children,
}: {
  id: string;
  children: (ctx: {
    listeners: Record<string, unknown>;
    isDragging: boolean;
    isOver: boolean;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, index, overIndex } =
    useSortable({ id });

  const isOver = !isDragging && overIndex === index;

  return (
    <Table.Tbody
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      {...attributes}
    >
      {children({ listeners, isDragging, isOver })}
    </Table.Tbody>
  );
}

function StaticGroupBody({
  children,
}: {
  children: (ctx: {
    listeners: Record<string, unknown>;
    isDragging: boolean;
    isOver: boolean;
  }) => React.ReactNode;
}) {
  return <Table.Tbody>{children({ listeners: {}, isDragging: false, isOver: false })}</Table.Tbody>;
}

interface GroupedInvoiceTableProps {
  orgId: string;
  invoices: IInvoice[];
  isDraftOpen: boolean;
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
    canViewPaymentMarks: boolean;
    canViewPaidDate: boolean;
    canManageFiles: boolean;
    canEditField?: (field: string) => boolean;
  };
  paymentMarks?: IPaymentMark[];
  onMarkForPayment?: (invoice: IInvoice) => void;
  onMarkPartialPayment?: (invoiceId: string, amount: number | undefined, comment: string) => void;
  onClearPaymentMark?: (markId: string) => void;
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  onFiles?: (invoice: IInvoice) => void;
  visibleColumns: InvoiceColumnId[];
  onReorderGroups?: (counterpartyOrder: string[]) => void;
  onAddClick?: () => void;
}

export function GroupedInvoiceTable({
  orgId,
  invoices,
  isDraftOpen,
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
  onMarkPartialPayment,
  onClearPaymentMark,
  filesByInvoice,
  onFiles,
  visibleColumns,
  onReorderGroups,
  onAddClick,
}: GroupedInvoiceTableProps) {
  const userMap = useUserMap();
  const groups = useMemo(() => groupInvoicesByCounterparty(invoices), [invoices]);
  const canDrag = permissions.canMove;

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
  const [draftErrors, setDraftErrors] = useState<DraftFieldErrors>({});
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const requestDraftCancel = () => {
    if (draftForm && isDraftDirty(draftForm)) {
      setDiscardConfirmOpen(true);
      return;
    }
    setDraftErrors({});
    onDraftCancel?.();
  };

  const handleDraftSaveClick = () => {
    if (!draftForm) {
      onDraftSave?.();
      return;
    }
    const errors = validateDraftFields(draftForm);
    if (Object.keys(errors).length > 0) {
      setDraftErrors(errors);
      return;
    }
    setDraftErrors({});
    onDraftSave?.();
  };

  const handleDraftChange = (field: keyof DraftInvoiceForm, value: unknown) => {
    setDraftErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as DraftFieldErrorKey];
      return next;
    });
    onDraftChange?.(field, value);
  };

  const handleDraftKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (e.currentTarget.getAttribute('aria-expanded') === 'true') return;
    e.preventDefault();
    handleDraftSaveClick();
  };

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

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    loadColumnSizing(orgId),
  );
  const columnSizingRef = useRef<ColumnSizingState>(columnSizing);

  useEffect(() => {
    columnSizingRef.current = columnSizing;
  }, [columnSizing]);

  useEffect(() => {
    const sizing = loadColumnSizing(orgId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumnSizing(sizing);
    columnSizingRef.current = sizing;
  }, [orgId]);

  const resizingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const resizePosRef = useRef<number>(0);

  const handleResizeStart = (colId: InvoiceColumnId, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const col = columnRenderers[colId];
    if (!col) return;
    const startWidth = columnSizing[colId] ?? col.width;
    resizingRef.current = { colId, startX: e.clientX, startWidth };

    const applyResize = () => {
      resizeFrameRef.current = null;
      const state = resizingRef.current;
      if (!state) return;
      const delta = resizePosRef.current - state.startX;
      const newWidth = Math.max(50, state.startWidth + delta);
      setColumnSizing((prev) => ({ ...prev, [state.colId]: newWidth }));
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groups.findIndex((g) => g.counterparty === active.id);
    const newIndex = groups.findIndex((g) => g.counterparty === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(
      groups.map((g) => g.counterparty),
      oldIndex,
      newIndex,
    );

    onReorderGroups?.(newOrder);
  };

  function handlePaySubmit(invoice: IInvoice, amount: number) {
    if (invoice.id.endsWith('__r')) {
      const parentId = invoice.id.slice(0, -3);
      onPayInvoice(parentId, amount);
    } else {
      onPayInvoice(invoice.id, amount);
    }
  }

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

  const columnRenderers: Record<
    InvoiceColumnId,
    {
      width: number;
      header: string;
      renderCell: (invoice: IInvoice) => React.ReactNode;
      renderDraft: () => React.ReactNode;
    }
  > = {
    counterparty: {
      width: 180,
      header: 'Контрагент',
      renderCell: () => null,
      renderDraft: () => (
        <Autocomplete
          size="xs"
          value={draftForm?.counterparty ?? ''}
          onChange={(v) => handleDraftChange('counterparty', v)}
          onKeyDown={handleDraftKeyDown}
          data={counterpartyResults || []}
          placeholder="Контрагент"
          error={draftErrors.counterparty}
        />
      ),
    },
    purpose: {
      width: 200,
      header: 'Назначение платежа',
      renderCell: (invoice) => <>{invoice.purpose}</>,
      renderDraft: () => (
        <TextInput
          size="xs"
          value={draftForm?.purpose ?? ''}
          onChange={(e) => handleDraftChange('purpose', e.currentTarget.value)}
          onKeyDown={handleDraftKeyDown}
          placeholder="Назначение"
          error={draftErrors.purpose}
        />
      ),
    },
    contract_no: {
      width: 150,
      header: 'Договор',
      renderCell: (invoice) => <>{invoice.contract_no || '—'}</>,
      renderDraft: () => (
        <TextInput
          size="xs"
          value={draftForm?.contract_no ?? ''}
          onChange={(e) => handleDraftChange('contract_no', e.currentTarget.value)}
          onKeyDown={handleDraftKeyDown}
          placeholder="Договор"
        />
      ),
    },
    invoice_no: {
      width: 120,
      header: 'Счет',
      renderCell: (invoice) => <>{invoice.invoice_no}</>,
      renderDraft: () => (
        <TextInput
          size="xs"
          value={draftForm?.invoice_no ?? ''}
          onChange={(e) => handleDraftChange('invoice_no', e.currentTarget.value)}
          onKeyDown={handleDraftKeyDown}
          placeholder="Счет"
          error={draftErrors.invoice_no}
        />
      ),
    },
    amount: {
      width: 100,
      header: 'Сумма',
      renderCell: (invoice) => <>{formatAmountRub(invoice.amount)}</>,
      renderDraft: () => (
        <NumberInput
          size="xs"
          value={draftForm?.amount ?? 0}
          onChange={(v) => handleDraftChange('amount', v ?? 0)}
          onKeyDown={handleDraftKeyDown}
          thousandSeparator=" "
          decimalSeparator=","
          placeholder="Сумма"
          error={draftErrors.amount}
        />
      ),
    },
    paid: {
      width: 130,
      header: 'Оплачено',
      renderCell: (invoice) => {
        const amounts = invoice.payment_amounts;
        if (permissions.canPay) {
          if (amounts.length > 0) {
            const isLast = amounts.length === 1;
            return (
              <Group gap={2} wrap="nowrap">
                <Badge color="green" variant="light">
                  {formatAmountRub(amounts[0]!)}
                </Badge>
                {isLast && (
                  <Tooltip label="Снять оплату">
                    <ActionIcon
                      size="sm"
                      color="red"
                      variant="subtle"
                      aria-label="Снять оплату"
                      onClick={() => setClearConfirmInvoiceId(invoice.id)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            );
          }
          if (invoice.paid) {
            return (
              <Badge color="green" variant="light">
                {formatAmountRub(
                  invoice.payment_amounts?.reduce((s, a) => s + a, 0) ?? invoice.amount,
                )}
              </Badge>
            );
          }
          return (
            <Button
              size="compact-xs"
              variant="light"
              color="orange"
              onClick={() => {
                setPayModalInvoice(invoice);
                setPayModalAmount(String(invoice.amount));
              }}
            >
              Оплатить…
            </Button>
          );
        }
        if (amounts.length > 0) {
          return (
            <Badge color="green" variant="light">
              {formatAmountRub(amounts[0]!)}
            </Badge>
          );
        }
        if (invoice.paid) {
          return (
            <Badge color="green" variant="light">
              {formatAmountRub(invoice.paid_amount ?? invoice.amount)}
            </Badge>
          );
        }
        return <Badge color="orange" variant="light">Не оплачено</Badge>;
      },
      renderDraft: () => null,
    },
    paid_date: {
      width: 120,
      header: 'Дата оплаты',
      renderCell: (invoice) => (
        <>{invoice.paid_date ? dayjs(invoice.paid_date).format('DD.MM.YYYY') : '—'}</>
      ),
      renderDraft: () => null,
    },
    comment: {
      width: 180,
      header: 'Комментарий',
      renderCell: (invoice) => <>{invoice.comment || '—'}</>,
      renderDraft: () => (
        <TextInput
          size="xs"
          value={draftForm?.comment ?? ''}
          onChange={(e) => handleDraftChange('comment', e.currentTarget.value)}
          onKeyDown={handleDraftKeyDown}
          placeholder="Комментарий"
        />
      ),
    },
    files: {
      width: 40,
      header: 'Файлы',
      renderCell: (invoice) => {
        const invoiceFiles = filesByInvoice?.[invoice.id];
        if (invoiceFiles?.length) {
          return (
            <Stack gap={2}>
              {invoiceFiles.map((f) => (
                <Anchor
                  key={f.id}
                  href={getInvoiceFileUrl(f)}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                >
                  {shortenFileName(f.name)}
                </Anchor>
              ))}
            </Stack>
          );
        }
        return (
          <Text size="xs" c="dimmed">
            —
          </Text>
        );
      },
      renderDraft: () => (
        <FileButton onChange={(v) => onDraftChange?.('file', v)}>
          {(props) => (
            <Tooltip label={draftForm?.file?.name ?? 'Прикрепить файл'}>
              <ActionIcon
                {...props}
                variant={draftForm?.file ? 'light' : 'subtle'}
                color={draftForm?.file ? 'blue' : 'gray'}
                size="sm"
              >
                <IconPaperclip size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </FileButton>
      ),
    },
    actions: {
      width: 50,
      header: 'Действия',
      renderCell: (invoice) => (
        <InvoiceActionsCell
          invoice={invoice}
          canUpdate={permissions.canUpdate}
          canDelete={permissions.canDelete}
          canViewHistory={permissions.canViewHistory}
          canMove={permissions.canMove}
          canCreate={permissions.canCreate}
          onEdit={onEdit}
          onDelete={onDelete}
          onHistory={onHistory}
          onMove={onMove}
          onFiles={onFiles}
          onCopy={onCopy}
        />
      ),
      renderDraft: () => null,
    },
    payment_mark: {
      width: 180,
      header: 'Отметка',
      renderCell: (invoice) => {
        const lookupId = invoice.id.endsWith('__r') ? invoice.id.slice(0, -3) : invoice.id;
        const mark = invoice.paid ? undefined : marksByInvoice[lookupId];
        return (
          <PaymentMarkCell
            invoice={invoice}
            mark={mark}
            canMarkPayment={permissions.canMarkPayment}
            canViewPaymentMarks={permissions.canViewPaymentMarks}
            onMarkForPayment={onMarkForPayment}
            onOpenPartialModal={(inv) => setPartialModal({ invoice: inv, amount: '', comment: '' })}
            onClearPaymentMark={onClearPaymentMark}
          />
        );
      },
      renderDraft: () => null,
    },
    initiator: {
      width: 120,
      header: 'Инициатор',
      renderCell: (invoice) => (
        <>{userMap.get(invoice.created_by)?.name ?? '—'}</>
      ),
      renderDraft: () => null,
    },
  };

  return (
    <>
      <InvoiceMobileCardView
        invoices={invoices}
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
        onEdit={onEdit}
        onHistory={onHistory}
        onMove={onMove}
        onFiles={onFiles}
        onCopy={onCopy}
        onDelete={onDelete}
        onMarkForPayment={onMarkForPayment}
        onMarkPartialPayment={onMarkPartialPayment}
        onClearPaymentMark={onClearPaymentMark}
        onOpenPayModal={(invoice) => {
          setPayModalInvoice(invoice);
          setPayModalAmount(String(invoice.amount));
        }}
        onClearPaymentConfirm={(id) => setClearConfirmInvoiceId(id)}
        onOpenPartialModal={(inv) => setPartialModal({ invoice: inv, amount: '', comment: '' })}
      />

      {/* Desktop table */}
      <Box visibleFrom="sm">
        {permissions.canCreate && onAddClick && (
          <Group justify="flex-end" mb="sm">
            <Button
              size="md"
              variant="light"
              leftSection={<IconPlus size={18} />}
              disabled={isDraftOpen}
              onClick={onAddClick}
            >
              Добавить счёт
            </Button>
          </Group>
        )}
        <Table highlightOnHover className="invoices-table" style={{ width: '100%', maxWidth: '100%', tableLayout: 'fixed' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                style={{
                  width: 50,
                  position: 'sticky',
                  top: 56,
                  zIndex: 1,
                  backgroundColor: 'var(--mantine-color-body)',
                  overflow: 'hidden',
                }}
              >
                №
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
                      top: 56,
                      zIndex: 1,
                      backgroundColor: 'var(--mantine-color-body)',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ overflow: 'hidden', maxWidth: '100%' }}>{col.header}</div>
                    <div
                      onMouseDown={(e) => handleResizeStart(colId, e)}
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
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={groups.map((g) => g.counterparty)}
                strategy={verticalListSortingStrategy}
              >
                {groups.map((group) => {
                  const counterpartyRowIndex = Math.ceil(group.invoices.length / 2);
                  const BORDER = '3.5px solid var(--org-color, var(--mantine-primary-color-filled))';
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
                          const hasMark = !!marksByInvoice[invoice.id];

                          const isNumHandle = true;
                          const isCpHandle = showCounterparty;

                        const amounts = invoice.payment_amounts ?? [];
                        const totalPaid = amounts.reduce((s, a) => s + a, 0);
                        const remaining = invoice.amount - totalPaid;

                        const hasCopies = amounts.length > 1;
                        const hasRemainder = totalPaid > 0 && remaining > 0;
                        const extraRows =
                          (hasCopies ? amounts.length - 1 : 0) + (hasRemainder ? 1 : 0);
                        const isLastRow = isGroupLast && extraRows === 0;

                        const rowStyle: React.CSSProperties = {
                          borderLeft: BORDER,
                          borderRight: BORDER,
                          ...(isGroupFirst ? { borderTop: BORDER } : {}),
                          ...(isLastRow ? { borderBottom: BORDER } : {}),
                            ...(paid
                              ? { backgroundColor: 'var(--mantine-color-yellow-1)' }
                              : hasMark
                                ? { backgroundColor: 'var(--mantine-color-green-0)' }
                                : isHighlighted
                                  ? { backgroundColor: 'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)' }
                                  : {}),
                          ...(isOver && isGroupFirst
                            ? { borderTop: '3px solid var(--mantine-color-blue-6)' }
                            : {}),
                        };

                        const rows: React.ReactNode[] = [];

                        // 1. Original row
                        rows.push(
                          <Table.Tr key={invoice.id} style={rowStyle}>
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
                                      <Text fw={600}>{group.counterparty}</Text>
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
                                  backgroundColor: 'var(--mantine-color-yellow-1)',
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
                                          <Tooltip label="Снять оплату">
                                            <Badge
                                              color="green"
                                              variant="light"
                                              aria-label="Снять оплату"
                                              style={{
                                                cursor: isLastCopy ? 'pointer' : 'default',
                                              }}
                                              onClick={
                                                isLastCopy
                                                  ? () => setClearConfirmInvoiceId(copyId)
                                                  : undefined
                                              }
                                            >
                                              {formatAmountRub(copyAmt)}
                                            </Badge>
                                          </Tooltip>
                                        ) : colId === 'purpose' ? (
                                          <Text size="xs" c="dimmed" fs="italic">
                                            {invoice.purpose}
                                          </Text>
                                        ) : (
                                          col.renderCell({
                                            ...invoice,
                                            id: copyId,
                                            comment: invoice.copy_comments?.[suffix] ?? invoice.comment,
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
                        if (totalPaid > 0 && remaining > 0) {
                          const remainderId = `${invoice.id}__r`;
                          const remainderInvoice = {
                            ...invoice,
                            id: remainderId,
                            amount: remaining,
                            paid: false,
                            paid_amount: null,
                            payment_amounts: [],
                            paid_date: null,
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
                                      {colId === 'counterparty' ? null : colId === 'amount' ? (
                                        <Text size="xs">
                                          <Text component="span" fw={700}>Остаток:</Text> {formatAmountRub(remaining)}
                                        </Text>
                                      ) : colId === 'purpose' ? (
                                        <Text size="xs" c="dimmed" fs="italic">
                                          {invoice.purpose}
                                        </Text>
                                      ) : (
                                        col.renderCell({
                                          ...remainderInvoice,
                                          comment: invoice.copy_comments?.['__r'] ?? invoice.comment,
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
                <Table.Tbody>
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                    <Table.Td>
                      <div style={{ overflow: 'hidden', maxWidth: '100%' }}>—</div>
                    </Table.Td>
                    {filteredColumns.map((colId) => {
                      const col = columnRenderers[colId];
                      const width = columnSizing[colId] ?? col.width;
                      return (
                        <Table.Td key={colId} style={{ width }}>
                          <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                            {colId === 'actions' ? (
                              <Group gap={4} wrap="nowrap">
                                <Tooltip label="Сохранить">
                                  <ActionIcon
                                    size="lg"
                                    color="green"
                                    variant="filled"
                                    aria-label="Сохранить счёт"
                                    onClick={handleDraftSaveClick}
                                  >
                                    <IconCheck size={14} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Отмена">
                                  <ActionIcon
                                    size="lg"
                                    color="gray"
                                    variant="filled"
                                    aria-label="Отменить добавление"
                                    onClick={requestDraftCancel}
                                  >
                                    <IconX size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            ) : (
                              col.renderDraft()
                            )}
                          </div>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                </Table.Tbody>
              )}
            </SortableContext>
          </DndContext>
          ) : (
            <>
              {groups.map((group) => {
                const counterpartyRowIndex = Math.ceil(group.invoices.length / 2);
                const BORDER = '3.5px solid var(--org-color, var(--mantine-primary-color-filled))';
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
                        const hasMark = !!marksByInvoice[invoice.id];

                        const amounts = invoice.payment_amounts ?? [];
                        const totalPaid = amounts.reduce((s, a) => s + a, 0);
                        const remaining = invoice.amount - totalPaid;

                        const hasCopies = amounts.length > 1;
                        const hasRemainder = totalPaid > 0 && remaining > 0;
                        const extraRows =
                          (hasCopies ? amounts.length - 1 : 0) + (hasRemainder ? 1 : 0);
                        const isLastRow = isGroupLast && extraRows === 0;

                        const rowStyle: React.CSSProperties = {
                          borderLeft: BORDER,
                          borderRight: BORDER,
                          ...(isGroupFirst ? { borderTop: BORDER } : {}),
                          ...(isLastRow ? { borderBottom: BORDER } : {}),
                            ...(paid
                              ? { backgroundColor: 'var(--mantine-color-yellow-1)' }
                              : hasMark
                                ? { backgroundColor: 'var(--mantine-color-green-0)' }
                                : isHighlighted
                                  ? { backgroundColor: 'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)' }
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
                                      <Text fw={600}>{group.counterparty}</Text>
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
                                  backgroundColor: 'var(--mantine-color-yellow-1)',
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
                                            comment: invoice.copy_comments?.[suffix] ?? invoice.comment,
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
                        if (totalPaid > 0 && remaining > 0) {
                          const remainderId = `${invoice.id}__r`;
                          const remainderInvoice = {
                            ...invoice,
                            id: remainderId,
                            amount: remaining,
                            paid: false,
                            paid_amount: null,
                            payment_amounts: [],
                            paid_date: null,
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
                                      {colId === 'counterparty' ? null : colId === 'amount' ? (
                                        <Text size="xs">
                                          <Text component="span" fw={700}>Остаток:</Text> {formatAmountRub(remaining)}
                                        </Text>
                                      ) : colId === 'purpose' ? (
                                        <Text size="xs" c="dimmed" fs="italic">
                                          {invoice.purpose}
                                        </Text>
                                      ) : (
                                        col.renderCell({
                                          ...remainderInvoice,
                                          comment: invoice.copy_comments?.['__r'] ?? invoice.comment,
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
                <Table.Tbody>
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                    <Table.Td>
                      <div style={{ overflow: 'hidden', maxWidth: '100%' }}>—</div>
                    </Table.Td>
                    {filteredColumns.map((colId) => {
                      const col = columnRenderers[colId];
                      const width = columnSizing[colId] ?? col.width;
                      return (
                        <Table.Td key={colId} style={{ width }}>
                          <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                            {colId === 'actions' ? (
                              <Group gap={4} wrap="nowrap">
                                <Tooltip label="Сохранить">
                                  <ActionIcon
                                    size="lg"
                                    color="green"
                                    variant="filled"
                                    aria-label="Сохранить счёт"
                                    onClick={handleDraftSaveClick}
                                  >
                                    <IconCheck size={14} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Отмена">
                                  <ActionIcon
                                    size="lg"
                                    color="gray"
                                    variant="filled"
                                    aria-label="Отменить добавление"
                                    onClick={requestDraftCancel}
                                  >
                                    <IconX size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            ) : (
                              col.renderDraft()
                            )}
                          </div>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                </Table.Tbody>
              )}
            </>
          )}
        </Table>
      </Box>

      {/* Modals */}
      <PayModal
        opened={!!payModalInvoice}
        onClose={() => {
          setPayModalInvoice(null);
          setPayModalAmount('');
        }}
        invoice={payModalInvoice}
        amount={payModalAmount}
        onAmountChange={(v) => setPayModalAmount(v)}
        onPay={(invoice, amount) => {
          handlePaySubmit(invoice, amount);
        }}
      />

      <PartialPaymentModal
        opened={!!partialModal}
        onClose={() => setPartialModal(null)}
        data={partialModal}
        onAmountChange={(v) => setPartialModal((prev) => (prev ? { ...prev, amount: v } : null))}
        onCommentChange={(v) => setPartialModal((prev) => (prev ? { ...prev, comment: v } : null))}
        onSave={(invoiceId, amount, comment) => {
          onMarkPartialPayment?.(invoiceId, amount, comment);
        }}
      />

      <ConfirmModal
        opened={!!clearConfirmInvoiceId}
        onClose={() => setClearConfirmInvoiceId(null)}
        onConfirm={() => {
          if (clearConfirmInvoiceId) {
            onClearPayment(clearConfirmInvoiceId);
          }
          setClearConfirmInvoiceId(null);
        }}
        title="Снятие оплаты"
        message="Снять отметку об оплате счёта?"
      />

      <ConfirmModal
        opened={discardConfirmOpen}
        onClose={() => setDiscardConfirmOpen(false)}
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          setDraftErrors({});
          onDraftCancel?.();
        }}
        title="Несохранённый счёт"
        message="Отменить добавление счёта? Введённые данные будут потеряны."
        confirmLabel="Отменить без сохранения"
      />
    </>
  );
}
