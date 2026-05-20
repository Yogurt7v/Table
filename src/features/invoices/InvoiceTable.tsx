import { useMemo, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import type { ColumnSizingState, OnChangeFn } from '@tanstack/react-table';
import {
  Text,
  Badge,
  Box,
  TextInput,
  NumberInput,
  Checkbox,
  ActionIcon,
  Group,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconCheck, IconX, IconHistory, IconArrowRight } from '@tabler/icons-react';
import type { IAccountingObject, IInvoice } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { loadColumnSizing, saveColumnSizing } from './invoice-table-column-sizing';
import {
  DRAFT_INVOICE_ID,
  createEmptyDraft,
  validateDraftForm,
  type DraftInvoiceForm,
  type InvoiceEditableField,
} from './invoice-field-access';
import { useInvoicePermissions } from '@/shared/hooks/useInvoicePermissions';
import { useCreateInvoice } from '@/shared/hooks/useCreateInvoice';
import { useUpdateInvoice } from '@/shared/hooks/useUpdateInvoice';
import { useDeleteInvoice } from '@/shared/hooks/useDeleteInvoice';
import { useMoveInvoice } from '@/shared/hooks/useMoveInvoice';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { InvoiceHistoryModal } from './InvoiceHistoryModal';
import { InvoiceMoveModal } from './InvoiceMoveModal';

interface InvoiceTableProps {
  orgId: string;
  objectId: string;
  date: string;
  invoices: IInvoice[];
  highlightedIds: string[];
  isDraftOpen: boolean;
  onCancelDraft: () => void;
  accountingObjects: IAccountingObject[];
}

const headCellStyle: React.CSSProperties = {
  whiteSpace: 'normal',
  verticalAlign: 'bottom',
  overflow: 'hidden',
};

const bodyCellStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 0,
};

function ColumnHeader({ label }: { label: string }) {
  return (
    <Text lineClamp={3} size="xs" fw={600} title={label}>
      {label}
    </Text>
  );
}

function EllipsisCell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      title={title}
      style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}
    >
      {children}
    </Box>
  );
}

function textCellValue(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function draftToTableRow(
  draft: DraftInvoiceForm,
  orgId: string,
  objectId: string,
  date: string,
): IInvoice {
  return {
    id: DRAFT_INVOICE_ID,
    organization_id: orgId,
    accounting_object_id: objectId,
    date,
    seq: 0,
    counterparty: draft.counterparty,
    purpose: draft.purpose,
    contract_no: draft.contract_no,
    invoice_no: draft.invoice_no,
    amount: draft.amount,
    paid: draft.paid,
    paid_date: draft.paid_date,
    comment: draft.comment,
  };
}

export function InvoiceTable({
  orgId,
  objectId,
  date,
  invoices,
  highlightedIds,
  isDraftOpen,
  onCancelDraft,
  accountingObjects,
}: InvoiceTableProps) {
  const permissions = useInvoicePermissions(orgId);
  const createInvoice = useCreateInvoice(orgId, date);
  const updateInvoice = useUpdateInvoice(orgId, date);
  const deleteInvoice = useDeleteInvoice(orgId, date);
  const moveInvoice = useMoveInvoice(orgId, date);

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    loadColumnSizing(orgId),
  );
  const [draftForm, setDraftForm] = useState<DraftInvoiceForm>(createEmptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<IInvoice | null>(null);
  const [historyInvoice, setHistoryInvoice] = useState<IInvoice | null>(null);
  const [moveInvoiceTarget, setMoveInvoiceTarget] = useState<IInvoice | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setColumnSizing(loadColumnSizing(orgId));
  }, [orgId]);

  useEffect(() => {
    if (isDraftOpen) {
      setDraftForm(createEmptyDraft());
    }
  }, [isDraftOpen]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleColumnSizingChange = useCallback<OnChangeFn<ColumnSizingState>>(
    (updater) => {
      setColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => saveColumnSizing(orgId, next), 300);
        return next;
      });
    },
    [orgId],
  );

  const tableData = useMemo(() => {
    if (!isDraftOpen) return invoices;
    return [...invoices, draftToTableRow(draftForm, orgId, objectId, date)];
  }, [invoices, isDraftOpen, draftForm, orgId, objectId, date]);

  const saveCell = useCallback(
    (row: IInvoice, field: keyof IInvoice, value: unknown) => {
      if (row.id === DRAFT_INVOICE_ID) return;
      const updates: Record<string, unknown> = { [field]: value };
      // Если отмечаем как оплачено, автоматически устанавливаем дату оплаты на сегодня
      if (field === 'paid' && value === true) {
        updates.paid_date = date.slice(0, 10);
      }
      // Если снимаем статус оплачено, очищаем дату оплаты
      if (field === 'paid' && value === false) {
        updates.paid_date = '';
      }
      updateInvoice.mutate({ id: row.id, ...updates });
    },
    [updateInvoice, date],
  );

  const handleSaveDraft = async () => {
    const error = validateDraftForm(draftForm);
    if (error) {
      notifications.show({ color: 'red', message: error });
      return;
    }
    try {
      await createInvoice.mutateAsync({
        organization_id: orgId,
        accounting_object_id: objectId,
        date,
        counterparty: draftForm.counterparty.trim(),
        purpose: draftForm.purpose.trim(),
        contract_no: draftForm.contract_no.trim(),
        invoice_no: draftForm.invoice_no.trim(),
        amount: draftForm.amount,
        paid: draftForm.paid,
        paid_date: draftForm.paid_date,
        comment: draftForm.comment.trim(),
      });
      onCancelDraft();
      notifications.show({ color: 'green', message: 'Счёт добавлен' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось создать счёт' });
    }
  };

  const patchDraft = (patch: Partial<DraftInvoiceForm>) => {
    setDraftForm((prev) => ({ ...prev, ...patch }));
  };

  const renderDraftInput = (
    field: keyof DraftInvoiceForm,
    options?: { type?: 'number' | 'date' | 'checkbox' },
  ) => (
    <Box onClick={(e) => e.stopPropagation()}>
      {options?.type === 'number' ? (
        <NumberInput
          size="xs"
          value={draftForm[field] as number}
          onChange={(v) => patchDraft({ [field]: v ?? 0 } as Partial<DraftInvoiceForm>)}
          thousandSeparator=" "
          decimalSeparator=","
          decimalScale={2}
          fixedDecimalScale
          allowDecimal
          min={0}
          step={0.01}
          hideControls
        />
      ) : options?.type === 'checkbox' ? (
        <Checkbox
          size="xs"
          checked={draftForm.paid}
          onChange={(e) => patchDraft({ paid: e.currentTarget.checked })}
          disabled={!permissions.canEditField('paid')}
        />
      ) : options?.type === 'date' ? (
        <TextInput
          size="xs"
          type="date"
          value={draftForm.paid_date}
          onChange={(e) => patchDraft({ paid_date: e.currentTarget.value })}
          disabled={!permissions.canEditField('paid_date')}
        />
      ) : (
        <TextInput
          size="xs"
          value={draftForm[field] as string}
          onChange={(e) =>
            patchDraft({ [field]: e.currentTarget.value } as Partial<DraftInvoiceForm>)
          }
        />
      )}
    </Box>
  );

  const columns = useMemo<MRT_ColumnDef<IInvoice>[]>(() => {
    const fieldEditable = (field: InvoiceEditableField) =>
      permissions.canEditField(field) ? true : false;

    return [
      {
        accessorKey: 'seq',
        header: '№',
        Header: () => <ColumnHeader label="№" />,
        size: 50,
        enableResizing: false,
        enableEditing: false,
        Cell: ({ row, table }) => {
          // Показываем порядковый номер: индекс строки + 1
          const rowIndex = table.getRowModel().rows.indexOf(row);
          if (row.original.id === DRAFT_INVOICE_ID) return '—';
          return <EllipsisCell title={String(rowIndex + 1)}>{rowIndex + 1}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'counterparty',
        header: 'Контрагент',
        Header: () => <ColumnHeader label="Контрагент" />,
        size: 180,
        enableEditing: fieldEditable('counterparty'),
        Cell: ({ row, cell }) => {
          if (row.original.id === DRAFT_INVOICE_ID) return renderDraftInput('counterparty');
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'purpose',
        header: 'Назначение платежа',
        Header: () => <ColumnHeader label="Назначение платежа" />,
        size: 200,
        enableEditing: fieldEditable('purpose'),
        Cell: ({ row, cell }) => {
          if (row.original.id === DRAFT_INVOICE_ID) return renderDraftInput('purpose');
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'contract_no',
        header: 'Номер договора',
        Header: () => <ColumnHeader label="Номер договора" />,
        size: 130,
        enableEditing: fieldEditable('contract_no'),
        Cell: ({ row, cell }) => {
          if (row.original.id === DRAFT_INVOICE_ID) return renderDraftInput('contract_no');
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'invoice_no',
        header: 'Номер счёта',
        Header: () => <ColumnHeader label="Номер счёта" />,
        size: 120,
        enableEditing: fieldEditable('invoice_no'),
        Cell: ({ row, cell }) => {
          if (row.original.id === DRAFT_INVOICE_ID) return renderDraftInput('invoice_no');
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'amount',
        header: 'Сумма',
        Header: () => <ColumnHeader label="Сумма" />,
        size: 120,
        enableEditing: fieldEditable('amount'),
        Cell: ({ row, cell }) => {
          if (row.original.id === DRAFT_INVOICE_ID)
            return renderDraftInput('amount', { type: 'number' });
          const title = formatAmountRub(cell.getValue<number>() ?? 0);
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
        Edit: ({ cell, row }) => (
          <NumberInput
            size="xs"
            defaultValue={cell.getValue<number>() ?? 0}
            decimalScale={2}
            fixedDecimalScale
            allowDecimal
            decimalSeparator=","
            thousandSeparator=" "
            hideControls
            onBlur={(e) => {
              const raw = e.currentTarget.value.replace(/\s/g, '').replace(',', '.');
              const parsed = Math.round(parseFloat(raw) * 100) / 100;
              if (!Number.isNaN(parsed)) saveCell(row.original, 'amount', parsed);
            }}
          />
        ),
      },
      {
        accessorKey: 'paid',
        header: 'Оплачено',
        Header: () => <ColumnHeader label="Оплачено" />,
        size: 100,
        enableEditing: fieldEditable('paid'),
        Cell: ({ row, cell }) => {
          if (row.original.id === DRAFT_INVOICE_ID) {
            return renderDraftInput('paid', { type: 'checkbox' });
          }
          const paid = cell.getValue<boolean>();
          const title = paid ? 'Да' : 'Нет';
          return (
            <EllipsisCell title={title}>
              <Badge color={paid ? 'green' : 'orange'}>{title}</Badge>
            </EllipsisCell>
          );
        },
        Edit: ({ cell, row }) => (
          <Checkbox
            checked={cell.getValue<boolean>()}
            onChange={(e) => saveCell(row.original, 'paid', e.currentTarget.checked)}
          />
        ),
      },
      {
        accessorKey: 'paid_date',
        header: 'Дата оплаты',
        Header: () => <ColumnHeader label="Дата оплаты" />,
        size: 120,
        enableEditing: fieldEditable('paid_date'),
        Cell: ({ row, cell }) => {
          if (row.original.id === DRAFT_INVOICE_ID) {
            return renderDraftInput('paid_date', { type: 'date' });
          }
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
        mantineEditTextInputProps: { type: 'date' },
      },
      {
        accessorKey: 'comment',
        header: 'Комментарий',
        Header: () => <ColumnHeader label="Комментарий" />,
        size: 180,
        enableEditing: fieldEditable('comment'),
        Cell: ({ row, cell }) => {
          if (row.original.id === DRAFT_INVOICE_ID) return renderDraftInput('comment');
          const raw = cell.getValue<string>();
          const title = raw || '';
          const display = title || '—';
          return <EllipsisCell title={title || '—'}>{display}</EllipsisCell>;
        },
      },
    ];
  }, [permissions, draftForm, renderDraftInput, saveCell]);

  const table = useMantineReactTable({
    columns,
    data: tableData,
    getRowId: (row) => row.id,
    layoutMode: 'grid',
    enableGrouping: false,
    enableColumnOrdering: false,
    enableColumnDragging: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: {
      minSize: 40,
      maxSize: 600,
      mantineEditTextInputProps: ({ cell, row }) => ({
        onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
          if (row.original.id === DRAFT_INVOICE_ID) return;
          const field = cell.column.id as keyof IInvoice;
          if (field === 'id' || field === 'organization_id' || field === 'accounting_object_id') {
            return;
          }
          let value: unknown = e.currentTarget.value;
          if (field === 'amount')
            value = Math.round(parseFloat(String(value).replace(',', '.')) * 100) / 100 || 0;
          saveCell(row.original, field, value);
        },
      }),
    },
    enableSorting: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableEditing: (row) => row.original.id !== DRAFT_INVOICE_ID && permissions.canUpdate,
    editDisplayMode: 'cell',
    enableRowActions: true,
    positionActionsColumn: 'last',
    displayColumnDefOptions: {
      'mrt-row-actions': {
        header: '',
        size: 110,
        enableResizing: false,
      },
    },
    renderRowActions: ({ row }) => {
      if (row.original.id === DRAFT_INVOICE_ID) {
        return (
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Сохранить">
              <ActionIcon
                size="sm"
                color="green"
                variant="light"
                onClick={() => void handleSaveDraft()}
                loading={createInvoice.isPending}
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Отмена">
              <ActionIcon size="sm" color="gray" variant="subtle" onClick={onCancelDraft}>
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        );
      }

      return (
        <Group gap={4} wrap="nowrap">
          {permissions.canViewHistory && (
            <Tooltip label="История">
              <ActionIcon
                size="sm"
                color="gray"
                variant="subtle"
                onClick={() => setHistoryInvoice(row.original)}
              >
                <IconHistory size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {permissions.canMove && (
            <Tooltip label="Перенести">
              <ActionIcon
                size="sm"
                color="blue"
                variant="subtle"
                onClick={() => setMoveInvoiceTarget(row.original)}
              >
                <IconArrowRight size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {permissions.canDelete && (
            <Tooltip label="Удалить">
              <ActionIcon
                size="sm"
                color="red"
                variant="subtle"
                onClick={() => setDeleteTarget(row.original)}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      );
    },
    state: {
      isLoading: false,
      columnSizing,
    },
    onColumnSizingChange: handleColumnSizingChange,
    mantineTableHeadRowProps: {
      style: { height: 'auto' },
    },
    mantineTableHeadCellProps: {
      style: headCellStyle,
    },
    mantineTableBodyCellProps: {
      style: bodyCellStyle,
    },
    mantineTableBodyRowProps: ({ row }) => {
      const styles: React.CSSProperties = {};
      if (row.original.id === DRAFT_INVOICE_ID) {
        styles.backgroundColor = 'var(--mantine-color-blue-0)';
      } else if (row.original.paid) {
        styles.backgroundColor = 'var(--mantine-color-yellow-1)';
      } else if (highlightedIds.includes(row.original.id)) {
        styles.backgroundColor = 'var(--mantine-color-yellow-0)';
      }
      return Object.keys(styles).length ? { style: styles } : {};
    },
    renderEmptyRowsFallback: () =>
      isDraftOpen ? null : (
        <Text p="md" c="dimmed">
          Нет счетов за эту дату
        </Text>
      ),
  });

  return (
    <>
      <MantineReactTable table={table} />
      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteInvoice.mutate(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        title="Удаление счёта"
        message={`Удалить счёт «${deleteTarget?.counterparty || deleteTarget?.invoice_no || ''}»?`}
        loading={deleteInvoice.isPending}
      />
      <InvoiceHistoryModal
        opened={!!historyInvoice}
        invoiceId={historyInvoice?.id ?? null}
        invoiceLabel={historyInvoice?.counterparty || historyInvoice?.invoice_no || ''}
        onClose={() => setHistoryInvoice(null)}
      />
      <InvoiceMoveModal
        opened={!!moveInvoiceTarget}
        onClose={() => setMoveInvoiceTarget(null)}
        objects={accountingObjects}
        currentObjectId={objectId}
        loading={moveInvoice.isPending}
        onConfirm={(targetObjectId) => {
          if (moveInvoiceTarget) {
            moveInvoice.mutate(
              { id: moveInvoiceTarget.id, accounting_object_id: targetObjectId },
              {
                onSuccess: () => {
                  setMoveInvoiceTarget(null);
                  notifications.show({ color: 'green', message: 'Счёт перенесён' });
                },
                onError: () => {
                  notifications.show({ color: 'red', message: 'Не удалось перенести счёт' });
                },
              },
            );
          }
        }}
      />
    </>
  );
}
