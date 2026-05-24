import { useState, useMemo } from 'react';
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
} from '@tabler/icons-react';
import type { IInvoice, IInvoiceFile, IPaymentMark, InvoiceColumnId } from '@/shared/types';
import { getInvoiceFileUrl } from '@/api/collections';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { groupInvoicesByCounterparty, getInvoiceNumber } from '@/shared/utils/group-invoices';
import { ALL_INVOICE_COLUMNS } from './invoice-columns';
import type { DraftInvoiceForm } from './invoice-field-access';

interface GroupedInvoiceTableProps {
  invoices: IInvoice[];
  isDraftOpen: boolean;
  draftForm?: DraftInvoiceForm;
  counterpartyResults?: string[];
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  onDraftSave?: () => void;
  onDraftCancel?: () => void;
  onEdit: (invoice: IInvoice) => void;
  onDelete: (invoice: IInvoice) => void;
  onHistory: (invoice: IInvoice) => void;
  onMove: (invoice: IInvoice) => void;
  onTogglePaid: (invoice: IInvoice) => void;
  highlightedIds: string[];
  permissions: {
    canUpdate: boolean;
    canDelete: boolean;
    canViewHistory: boolean;
    canMove: boolean;
    canMarkPayment: boolean;
    canViewPaymentMarks: boolean;
    canManageFiles: boolean;
    canEditField?: (field: string) => boolean;
  };
  paymentMarks?: IPaymentMark[];
  onMarkForPayment?: (invoice: IInvoice) => void;
  onMarkPartialPayment?: (invoiceId: string, amount: number, comment: string) => void;
  onClearPaymentMark?: (markId: string) => void;
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  onFiles?: (invoice: IInvoice) => void;
  visibleColumns: InvoiceColumnId[];
}

export function GroupedInvoiceTable({
  invoices,
  isDraftOpen,
  draftForm,
  counterpartyResults,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onEdit,
  onDelete,
  onHistory,
  onMove,
  onTogglePaid,
  highlightedIds,
  permissions,
  paymentMarks,
  onMarkForPayment,
  onMarkPartialPayment,
  onClearPaymentMark,
  filesByInvoice,
  onFiles,
  visibleColumns,
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

  const [partialForm, setPartialForm] = useState<{
    invoiceId: string;
    amount: string;
    comment: string;
  } | null>(null);

  const filteredColumns = useMemo(
    () =>
      visibleColumns.filter((colId) => {
        if (colId === 'payment_mark') return permissions.canViewPaymentMarks;
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

  if (groups.length === 0 && !isDraftOpen) {
    return (
      <Text c="dimmed" ta="center" py="md">
        Нет счетов за эту дату
      </Text>
    );
  }

  function renderPaymentMarkCell(invoice: IInvoice) {
    const mark = marksByInvoice[invoice.id];
    const isPartialFormOpen = partialForm?.invoiceId === invoice.id;

    if (permissions.canMarkPayment) {
      if (isPartialFormOpen) {
        return (
          <Group gap={4} wrap="nowrap">
            <NumberInput
              size="xs"
              style={{ width: 100 }}
              value={partialForm?.amount ?? ''}
              onChange={(v) =>
                setPartialForm((prev) => (prev ? { ...prev, amount: String(v ?? '') } : null))
              }
              thousandSeparator=" "
              decimalSeparator=","
              placeholder="Сумма"
            />
            <Textarea
              size="xs"
              style={{ width: 140 }}
              value={partialForm?.comment ?? ''}
              onChange={(e) =>
                setPartialForm((prev) =>
                  prev ? { ...prev, comment: e.currentTarget.value } : null,
                )
              }
              placeholder="Комментарий"
              autosize
              minRows={1}
              maxRows={3}
            />
            <Tooltip label="Сохранить">
              <ActionIcon
                size="sm"
                color="green"
                variant="light"
                onClick={() => {
                  const amount = Number(partialForm?.amount);
                  if (!amount || amount <= 0) return;
                  onMarkPartialPayment?.(invoice.id, amount, partialForm?.comment ?? '');
                  setPartialForm(null);
                }}
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Отмена">
              <ActionIcon
                size="sm"
                color="gray"
                variant="subtle"
                onClick={() => setPartialForm(null)}
              >
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        );
      }

      if (mark) {
        if (mark.amount == null) {
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
                <Text size="xs" c="dimmed">
                  {mark.comment}
                </Text>
              )}
            </Box>
            <Tooltip label="Убрать отметку">
              <ActionIcon
                size="xs"
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
          <Button
            size="xs"
            onClick={() => onMarkForPayment?.(invoice)}
          >
            Оплатить
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => setPartialForm({ invoiceId: invoice.id, amount: '', comment: '' })}
          >
            частично
          </Button>
        </Group>
      );
    }

    if (permissions.canViewPaymentMarks && mark) {
      if (mark.amount == null) {
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
            <ActionIcon size="sm" variant="subtle" color="gray">
              <IconSettings size={24} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown>
          {permissions.canUpdate && (
            <Menu.Item
              leftSection={<IconPencil size={14} />}
              onClick={() => onEdit(invoice)}
            >
              Редактировать
            </Menu.Item>
          )}
          {permissions.canViewHistory && (
            <Menu.Item
              leftSection={<IconHistory size={14} />}
              onClick={() => onHistory(invoice)}
            >
              История
            </Menu.Item>
          )}
          {permissions.canMove && (
            <Menu.Item
              leftSection={<IconArrowRight size={14} />}
              onClick={() => onMove(invoice)}
            >
              Перенести
            </Menu.Item>
          )}
          <Menu.Item
            leftSection={<IconFile size={14} />}
            onClick={() => onFiles?.(invoice)}
          >
            Файлы
          </Menu.Item>
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
      renderCell: (_invoice) => null, // handled specially below
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
      width: 100,
      header: 'Оплачено',
      renderCell: (invoice) => {
        if (permissions.canUpdate) {
          return (
            <Badge
              color={invoice.paid ? 'green' : 'orange'}
              onClick={() => onTogglePaid(invoice)}
              style={{ cursor: 'pointer' }}
            >
              {invoice.paid ? 'Да' : 'Нет'}
            </Badge>
          );
        }
        return (
          <Badge color={invoice.paid ? 'green' : 'orange'}>
            {invoice.paid ? 'Да' : 'Нет'}
          </Badge>
        );
      },
      renderDraft: () => (
        <input
          type="checkbox"
          checked={draftForm?.paid ?? false}
          onChange={(e) => onDraftChange?.('paid', e.currentTarget.checked)}
        />
      ),
    },
    paid_date: {
      width: 120,
      header: 'Дата оплаты',
      renderCell: (invoice) => <>{invoice.paid_date || '—'}</>,
      renderDraft: () => (
        <TextInput
          size="xs"
          type="date"
          value={draftForm?.paid_date ?? ''}
          onChange={(e) => onDraftChange?.('paid_date', e.currentTarget.value)}
        />
      ),
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
                  {f.name}
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
    <Box style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 50 }}>№</Table.Th>
            {filteredColumns.map((colId) => {
              const col = columnRenderers[colId];
              return (
                <Table.Th key={colId} style={{ width: col.width }}>
                  {col.header}
                </Table.Th>
              );
            })}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {groups.map((group) => {
            const counterpartyRowIndex = Math.ceil(group.invoices.length / 2);
            return group.invoices.map((invoice, idx) => {
              const invoiceNumber = getInvoiceNumber(groups, invoice.id);
              const showCounterparty = idx === counterpartyRowIndex - 1;
              const paid = invoice.paid;
              const isHighlighted = highlightedIds.includes(invoice.id);
              const hasMark = !!marksByInvoice[invoice.id];
              const rowStyle: React.CSSProperties = paid
                ? { backgroundColor: 'var(--mantine-color-yellow-1)' }
                : hasMark
                  ? { backgroundColor: 'var(--mantine-color-green-0)' }
                  : isHighlighted
                    ? { backgroundColor: 'var(--mantine-color-yellow-0)' }
                    : {};

              return (
                <Table.Tr key={invoice.id} style={rowStyle}>
                  <Table.Td>{invoiceNumber}</Table.Td>
                  {filteredColumns.map((colId) => (
                    <Table.Td key={colId}>
                      {colId === 'counterparty' && showCounterparty ? (
                        <Text fw={600}>{group.counterparty}</Text>
                      ) : colId === 'counterparty' ? null : (
                        columnRenderers[colId].renderCell(invoice)
                      )}
                    </Table.Td>
                  ))}
                </Table.Tr>
              );
            });
          })}
          {isDraftOpen && draftForm && (
            <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
              <Table.Td>—</Table.Td>
              {filteredColumns.map((colId) => (
                <Table.Td key={colId}>
                  {colId === 'actions' ? (
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="Сохранить">
                        <ActionIcon size="sm" color="green" variant="light" onClick={onDraftSave}>
                          <IconCheck size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Отмена">
                        <ActionIcon size="sm" color="gray" variant="subtle" onClick={onDraftCancel}>
                          <IconX size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  ) : (
                    columnRenderers[colId].renderDraft()
                  )}
                </Table.Td>
              ))}
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
