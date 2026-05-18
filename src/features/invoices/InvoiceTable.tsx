import { useMemo, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table';
import type { ColumnSizingState, OnChangeFn } from '@tanstack/react-table';
import { Text, Badge, Box } from '@mantine/core';
import type { IInvoice } from '@/shared/types';
import { loadColumnSizing, saveColumnSizing } from './invoice-table-column-sizing';

interface InvoiceTableProps {
  orgId: string;
  invoices: IInvoice[];
  highlightedIds: string[];
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

export function InvoiceTable({ orgId, invoices, highlightedIds }: InvoiceTableProps) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    loadColumnSizing(orgId),
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setColumnSizing(loadColumnSizing(orgId));
  }, [orgId]);

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

  const columns = useMemo<MRT_ColumnDef<IInvoice>[]>(
    () => [
      {
        accessorKey: 'seq',
        header: '№',
        Header: () => <ColumnHeader label="№" />,
        size: 50,
        enableResizing: false,
        Cell: ({ cell }) => {
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'counterparty',
        header: 'Контрагент',
        Header: () => <ColumnHeader label="Контрагент" />,
        size: 180,
        Cell: ({ cell }) => {
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'purpose',
        header: 'Назначение платежа',
        Header: () => <ColumnHeader label="Назначение платежа" />,
        size: 200,
        Cell: ({ cell }) => {
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'contract_no',
        header: 'Номер договора',
        Header: () => <ColumnHeader label="Номер договора" />,
        size: 130,
        Cell: ({ cell }) => {
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'invoice_no',
        header: 'Номер счёта',
        Header: () => <ColumnHeader label="Номер счёта" />,
        size: 120,
        Cell: ({ cell }) => {
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'amount',
        header: 'Сумма',
        Header: () => <ColumnHeader label="Сумма" />,
        size: 120,
        Cell: ({ cell }) => {
          const title = `${(cell.getValue<number>() ?? 0).toLocaleString()} ₽`;
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'paid',
        header: 'Оплачено',
        Header: () => <ColumnHeader label="Оплачено" />,
        size: 100,
        Cell: ({ cell }) => {
          const paid = cell.getValue<boolean>();
          const title = paid ? 'Да' : 'Нет';
          return (
            <EllipsisCell title={title}>
              <Badge color={paid ? 'green' : 'orange'}>{title}</Badge>
            </EllipsisCell>
          );
        },
      },
      {
        accessorKey: 'paid_date',
        header: 'Дата оплаты',
        Header: () => <ColumnHeader label="Дата оплаты" />,
        size: 120,
        Cell: ({ cell }) => {
          const title = textCellValue(cell.getValue());
          return <EllipsisCell title={title}>{title}</EllipsisCell>;
        },
      },
      {
        accessorKey: 'comment',
        header: 'Комментарий',
        Header: () => <ColumnHeader label="Комментарий" />,
        size: 180,
        Cell: ({ cell }) => {
          const raw = cell.getValue<string>();
          const title = raw || '';
          const display = title || '—';
          return <EllipsisCell title={title || '—'}>{display}</EllipsisCell>;
        },
      },
    ],
    [],
  );

  const table = useMantineReactTable({
    columns,
    data: invoices,
    layoutMode: 'grid',
    enableGrouping: false,
    enableColumnOrdering: false,
    enableColumnDragging: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: {
      minSize: 40,
      maxSize: 600,
    },
    enableSorting: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enableTopToolbar: false,
    enableBottomToolbar: false,
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
      if (highlightedIds.includes(row.original.id)) {
        return {
          style: { backgroundColor: 'var(--mantine-color-yellow-0)' } as React.CSSProperties,
        };
      }
      return {};
    },
    renderEmptyRowsFallback: () => <Text p="md" c="dimmed">Нет счетов</Text>,
  });

  return <MantineReactTable table={table} />;
}
