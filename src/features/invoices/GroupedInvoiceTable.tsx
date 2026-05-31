import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Table,
  Text,
  Badge,
  Box,
  ActionIcon,
  Group,
  Tooltip,
  TextInput,
  Autocomplete,
  NumberInput,
  Textarea,
  Checkbox,
  Button,
  Menu,
  Stack,
  Anchor,
  Modal,
} from '@mantine/core';
import {
  IconTrash,
  IconCheck,
  IconX,
  IconHistory,
  IconArrowRight,
  IconPencil,
  IconSettings,
  IconFile,
  IconCopy,
} from '@tabler/icons-react';
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
import { groupInvoicesByCounterparty, getInvoiceNumber } from '@/shared/utils/group-invoices';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { DraftInvoiceForm } from './invoice-field-access';
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
}: GroupedInvoiceTableProps) {
  const groups = groupInvoicesByCounterparty(invoices);

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
    setColumnSizing(sizing);
    columnSizingRef.current = sizing;
  }, [orgId]);

  const resizingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = (colId: InvoiceColumnId, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const col = columnRenderers[colId];
    if (!col) return;
    const startWidth = columnSizing[colId] ?? col.width;
    resizingRef.current = { colId, startX: e.clientX, startWidth };

    const handleMouseMove = (e: MouseEvent) => {
      const state = resizingRef.current;
      if (!state) return;
      const delta = e.clientX - state.startX;
      const newWidth = Math.max(50, state.startWidth + delta);
      setColumnSizing((prev) => ({ ...prev, [state.colId]: newWidth }));
    };

    const handleMouseUp = () => {
      if (resizingRef.current) {
        saveColumnSizing(orgId, columnSizingRef.current);
      }
      resizingRef.current = null;
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
      <Text c="dimmed" ta="center" py="md">
        Нет счетов
      </Text>
    );
  }

  function renderPaymentMarkCell(invoice: IInvoice) {
    const mark = marksByInvoice[invoice.id];

    if (permissions.canMarkPayment) {
      if (mark) {
        if (mark.amount == null || mark.amount === 0) {
          if (mark.comment) {
            return (
              <Group gap={4} wrap="nowrap">
                <Box style={{ fontSize: 12, lineHeight: 1.3 }}>
                  <Text size="xs" fw={600}>
                    Оплатить: {mark.comment}
                  </Text>
                </Box>
                <Tooltip label="Убрать отметку">
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="subtle"
                    onClick={() => onClearPaymentMark?.(mark.id)}
                  >
                    <IconX size={12} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            );
          }
          return (
            <Checkbox
              size="xs"
              label={formatAmountRub(invoice.amount)}
              checked
              onChange={() => onClearPaymentMark?.(mark.id)}
            />
          );
        }
        return (
          <Group gap={4} wrap="nowrap">
            <Box style={{ fontSize: 12, lineHeight: 1.3 }}>
              <Text size="xs" fw={600}>
                ОПЛАТИТЬ: {formatAmountRub(mark.amount)}
              </Text>
              {mark.comment && (
                <Tooltip label={mark.comment}>
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {mark.comment}
                  </Text>
                </Tooltip>
              )}
            </Box>
            <Tooltip label="Убрать отметку">
              <ActionIcon
                size="sm"
                color="red"
                variant="subtle"
                onClick={() => onClearPaymentMark?.(mark.id)}
              >
                <IconX size={12} />
              </ActionIcon>
            </Tooltip>
          </Group>
        );
      }

      return (
        <Group gap={4} wrap="nowrap">
          <Button size="xs" onClick={() => onMarkForPayment?.(invoice)}>
            Оплатить
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => setPartialModal({ invoice, amount: '', comment: '' })}
          >
            частично
          </Button>
        </Group>
      );
    }

    if (permissions.canViewPaymentMarks && mark) {
      if (mark.amount == null || mark.amount === 0) {
        if (mark.comment) {
          return (
            <Text size="xs" fw={600}>
              Оплатить: {mark.comment}
            </Text>
          );
        }
        return (
          <Text size="xs" fw={600}>
            {formatAmountRub(invoice.amount)}
          </Text>
        );
      }
      return (
        <Box style={{ fontSize: 12, lineHeight: 1.3 }}>
          <Text size="xs" fw={600}>
            {formatAmountRub(mark.amount)}
          </Text>
          {mark.comment && (
            <Text size="xs" c="dimmed">
              {mark.comment}
            </Text>
          )}
        </Box>
      );
    }

    return (
      <Text size="xs" c="dimmed">
        —
      </Text>
    );
  }

  function renderActionsCell(invoice: IInvoice) {
    return (
      <Menu position="bottom-end" shadow="md" width={200} withinPortal>
        <Menu.Target>
          <Tooltip label="Действия">
            <ActionIcon ml="15px" size="sm" variant="subtle" color="gray">
              <IconSettings size={24} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown>
          {permissions.canUpdate && (
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => onEdit(invoice)}>
              Редактировать
            </Menu.Item>
          )}
          {permissions.canViewHistory && (
            <Menu.Item leftSection={<IconHistory size={14} />} onClick={() => onHistory(invoice)}>
              История
            </Menu.Item>
          )}
          {permissions.canMove && (
            <Menu.Item leftSection={<IconArrowRight size={14} />} onClick={() => onMove(invoice)}>
              Перенести
            </Menu.Item>
          )}
          <Menu.Item leftSection={<IconFile size={14} />} onClick={() => onFiles?.(invoice)}>
            Файлы
          </Menu.Item>
          {permissions.canCreate && (
            <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => onCopy?.(invoice)}>
              Копировать
            </Menu.Item>
          )}
          {permissions.canDelete && (
            <Menu.Item
              leftSection={<IconTrash size={14} />}
              color="red"
              onClick={() => onDelete(invoice)}
            >
              Удалить
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
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
      renderCell: (_invoice) => null,
      renderDraft: () => (
        <Autocomplete
          size="xs"
          value={draftForm?.counterparty ?? ''}
          onChange={(v) => onDraftChange?.('counterparty', v)}
          data={counterpartyResults || []}
          placeholder="Контрагент"
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
          onChange={(e) => onDraftChange?.('purpose', e.currentTarget.value)}
          placeholder="Назначение"
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
          onChange={(e) => onDraftChange?.('contract_no', e.currentTarget.value)}
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
          onChange={(e) => onDraftChange?.('invoice_no', e.currentTarget.value)}
          placeholder="Счет"
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
          onChange={(v) => onDraftChange?.('amount', v ?? 0)}
          thousandSeparator=" "
          decimalSeparator=","
          placeholder="Сумма"
        />
      ),
    },
    paid: {
      width: 130,
      header: 'Оплачено',
      renderCell: (invoice) => {
        const amounts = invoice.payment_amounts;
        if (permissions.canUpdate) {
          if (amounts.length > 0) {
            const isLast = amounts.length === 1;
            return (
              <Badge
                color="green"
                variant="light"
                style={{ cursor: isLast ? 'pointer' : 'default' }}
                onClick={isLast ? () => setClearConfirmInvoiceId(invoice.id) : undefined}
              >
                {formatAmountRub(amounts[0]!)}
              </Badge>
            );
          }
          if (invoice.paid) {
            return (
              <Badge color="green" variant="light">
                {formatAmountRub(invoice.payment_amounts?.reduce((s, a) => s + a, 0) ?? invoice.amount)}
              </Badge>
            );
          }
          return (
            <Badge
              color="orange"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setPayModalInvoice(invoice);
                setPayModalAmount(String(invoice.amount));
              }}
            >
              Нет
            </Badge>
          );
        }
        if (amounts.length > 0) {
          return (
            <Text size="xs" fw={600}>
              {formatAmountRub(amounts[0]!)}
            </Text>
          );
        }
        if (invoice.paid) {
          return (
            <Badge color="green" variant="light">
              {formatAmountRub(invoice.paid_amount ?? invoice.amount)}
            </Badge>
          );
        }
        return <Badge color="orange">Нет</Badge>;
      },
      renderDraft: () => null,
    },
    paid_date: {
      width: 120,
      header: 'Дата оплаты',
      renderCell: (invoice) => <>{invoice.paid_date || '—'}</>,
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
          onChange={(e) => onDraftChange?.('comment', e.currentTarget.value)}
          placeholder="Комментарий"
        />
      ),
    },
    files: {
      width: 160,
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
      renderDraft: () => null,
    },
    actions: {
      width: 50,
      header: 'Действия',
      renderCell: renderActionsCell,
      renderDraft: () => null,
    },
    payment_mark: {
      width: 180,
      header: 'Отметка',
      renderCell: renderPaymentMarkCell,
      renderDraft: () => null,
    },
  };

  return (
    <Box style={{ overflow: 'hidden' }}>
      <Table
        // striped
        highlightOnHover
        style={{ width: '100%', maxWidth: '100%', tableLayout: 'fixed', overflow: 'hidden' }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 50, overflow: 'hidden' }}>№</Table.Th>
            {filteredColumns.map((colId) => {
              const col = columnRenderers[colId];
              const width = columnSizing[colId] ?? col.width;
              return (
                <Table.Th key={colId} style={{ width, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ overflow: 'hidden', maxWidth: '100%' }}>{col.header}</div>
                  <div
                    onMouseDown={(e) => handleResizeStart(colId, e)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 6,
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
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={groups.map((g) => g.counterparty)}
            strategy={verticalListSortingStrategy}
          >
            {groups.map((group) => {
              const counterpartyRowIndex = Math.ceil(group.invoices.length / 2);
              const BORDER = `1.5px dashed var(--mantine-primary-color-filled)`;
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

                      const precedingRows = group.invoices.slice(0, idx).reduce(
                        (sum, inv) => sum + getExpandedCount(inv), 0,
                      );
                      const followingRows = group.invoices.slice(idx + 1).reduce(
                        (sum, inv) => sum + getExpandedCount(inv), 0,
                      );
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
                      const extraRows = (hasCopies ? amounts.length - 1 : 0) + (hasRemainder ? 1 : 0);
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
                              ? { backgroundColor: 'var(--mantine-color-yellow-0)' }
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
                            <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                              {invoiceNumber}
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
                                        <Badge
                                          color="green"
                                          variant="light"
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
                                      ) : colId === 'purpose' ? (
                                        <Text size="xs" c="dimmed" fs="italic">
                                          {invoice.purpose}
                                        </Text>
                                      ) : (
                                        col.renderCell({
                                          ...invoice,
                                          id: copyId,
                                          amount: copyAmt,
                                          paid: true,
                                          paid_amount: null,
                                          payment_amounts: [],
                                          paid_date: null,
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
                                      <Text size="xs" c="dimmed">
                                        Остаток: {formatAmountRub(remaining)}
                                      </Text>
                                    ) : colId === 'purpose' ? (
                                      <Text size="xs" c="dimmed" fs="italic">
                                        {invoice.purpose}
                                      </Text>
                                    ) : (
                                      col.renderCell(remainderInvoice)
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
                                  onClick={onDraftSave}
                                >
                                  <IconCheck size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Отмена">
                                <ActionIcon
                                  size="lg"
                                  color="gray"
                                  variant="filled"
                                  onClick={onDraftCancel}
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
      </Table>

      <Modal
        opened={!!payModalInvoice}
        onClose={() => setPayModalInvoice(null)}
        title="Оплата счёта"
        size="sm"
      >
        {payModalInvoice && (
          <Stack gap="sm">
            <Group gap={4}>
              <Text size="sm" fw={600}>
                Контрагент:
              </Text>
              <Text size="sm">{payModalInvoice.counterparty}</Text>
            </Group>
            <Group gap={4}>
              <Text size="sm" fw={600}>
                Назначение:
              </Text>
              <Text size="sm">{payModalInvoice.purpose}</Text>
            </Group>
            <Group gap={4}>
              <Text size="sm" fw={600}>
                Сумма счёта:
              </Text>
              <Text size="sm">{formatAmountRub(payModalInvoice.amount)}</Text>
            </Group>
            <NumberInput
              label="Сумма к оплате"
              value={payModalAmount}
              onChange={(v) => setPayModalAmount(String(v ?? ''))}
              thousandSeparator=" "
              decimalSeparator=","
              min={0}
              max={payModalInvoice.amount}
              clampBehavior="strict"
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setPayModalInvoice(null)}>
                Отмена
              </Button>
              <Button
                color="green"
                onClick={() => {
                  const amount = Math.min(Number(payModalAmount), payModalInvoice.amount);
                  if (!amount || amount <= 0) return;
                  handlePaySubmit(payModalInvoice, amount);
                  setPayModalInvoice(null);
                  setPayModalAmount('');
                }}
              >
                Оплатить
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={!!partialModal}
        onClose={() => setPartialModal(null)}
        title="Частичная оплата"
        size="sm"
      >
        {partialModal && (
          <Stack gap="sm">
            <Group gap={4}>
              <Text size="sm" fw={600}>Контрагент:</Text>
              <Text size="sm">{partialModal.invoice.counterparty}</Text>
            </Group>
            <Group gap={4}>
              <Text size="sm" fw={600}>Назначение:</Text>
              <Text size="sm">{partialModal.invoice.purpose}</Text>
            </Group>
            <Group gap={4}>
              <Text size="sm" fw={600}>Номер счёта:</Text>
              <Text size="sm">{partialModal.invoice.invoice_no}</Text>
            </Group>
            <Group gap={4}>
              <Text size="sm" fw={600}>Дата:</Text>
              <Text size="sm">{partialModal.invoice.date}</Text>
            </Group>
            <Group gap={4}>
              <Text size="sm" fw={600}>Договор:</Text>
              <Text size="sm">{partialModal.invoice.contract_no}</Text>
            </Group>
            <Group gap={4}>
              <Text size="sm" fw={600}>Сумма счёта:</Text>
              <Text size="sm">{formatAmountRub(partialModal.invoice.amount)}</Text>
            </Group>
            {partialModal.invoice.comment && (
              <Group gap={4}>
                <Text size="sm" fw={600}>Комментарий:</Text>
                <Text size="sm">{partialModal.invoice.comment}</Text>
              </Group>
            )}
            <NumberInput
              label="Сумма к оплате"
              value={partialModal.amount}
              onChange={(v) =>
                setPartialModal((prev) =>
                  prev ? { ...prev, amount: String(v ?? '') } : null,
                )
              }
              thousandSeparator=" "
              decimalSeparator=","
              min={0}
              max={partialModal.invoice.amount}
              clampBehavior="strict"
            />
            <Textarea
              label="Комментарий к оплате"
              value={partialModal.comment}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setPartialModal((prev) =>
                  prev ? { ...prev, comment: value } : null,
                );
              }}
              placeholder="Опционально"
              autosize
              minRows={2}
              maxRows={5}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setPartialModal(null)}>
                Отмена
              </Button>
              <Button
                color="green"
                onClick={() => {
                  const parsedAmount = Number(partialModal.amount);
                  const hasAmount = parsedAmount > 0;
                  const hasComment = partialModal.comment.trim().length > 0;
                  if (!hasAmount && !hasComment) return;
                  if (hasAmount) {
                    const amount = Math.min(parsedAmount, partialModal.invoice.amount);
                    onMarkPartialPayment?.(partialModal.invoice.id, amount, partialModal.comment);
                  } else {
                    onMarkPartialPayment?.(partialModal.invoice.id, undefined, partialModal.comment);
                  }
                  setPartialModal(null);
                }}
              >
                Сохранить
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

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
    </Box>
  );
}
