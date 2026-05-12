import { useMemo } from 'react';
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table';
import { Text, Badge } from '@mantine/core';
import type { IInvoice } from '@/shared/types';

interface InvoiceTableProps {
  invoices: IInvoice[];
  highlightedIds: string[];
}

function groupTotal(rows: IInvoice[]): string {
  const sum = rows.reduce((acc, r) => acc + (r.amount || 0), 0);
  const count = rows.length;
  const label = count === 1 ? 'счёт' : count >= 2 && count <= 4 ? 'счета' : 'счетов';
  return `═══ ${count} ${label} · Итого: ${sum.toLocaleString()} ₽ ═══`;
}

export function InvoiceTable({ invoices, highlightedIds }: InvoiceTableProps) {
  const columns = useMemo<MRT_ColumnDef<IInvoice>[]>(
    () => [
      {
        accessorKey: 'seq',
        header: '№',
        size: 50,
      },
      {
        accessorKey: 'counterparty',
        header: 'Контрагент',
        size: 180,
        Cell: ({ cell, row }) => {
          if (row.getIsGrouped()) {
            const subRows = row.subRows ?? [];
            const items = subRows.map((r) => r.original);
            return (
              <Text fw={700} size="sm">
                {groupTotal(items)}
              </Text>
            );
          }
          return cell.getValue<string>();
        },
      },
      {
        accessorKey: 'purpose',
        header: 'Назначение платежа',
        size: 200,
      },
      {
        accessorKey: 'contract_no',
        header: 'Номер договора',
        size: 130,
      },
      {
        accessorKey: 'invoice_no',
        header: 'Номер счёта',
        size: 120,
      },
      {
        accessorKey: 'amount',
        header: 'Сумма',
        size: 120,
        Cell: ({ cell, row }) => {
          if (row.getIsGrouped()) return null;
          return `${(cell.getValue<number>() ?? 0).toLocaleString()} ₽`;
        },
      },
      {
        accessorKey: 'paid',
        header: 'Оплачено',
        size: 100,
        Cell: ({ cell, row }) => {
          if (row.getIsGrouped()) return null;
          return <Badge color={cell.getValue<boolean>() ? 'green' : 'orange'}>{cell.getValue<boolean>() ? 'Да' : 'Нет'}</Badge>;
        },
      },
      {
        accessorKey: 'paid_date',
        header: 'Дата оплаты',
        size: 120,
        Cell: ({ cell, row }) => {
          if (row.getIsGrouped()) return null;
          return cell.getValue<string>() || '—';
        },
      },
      {
        accessorKey: 'comment',
        header: 'Комментарий',
        size: 180,
        Cell: ({ cell, row }) => {
          if (row.getIsGrouped()) return null;
          return cell.getValue<string>() || '';
        },
      },
    ],
    [],
  );

  const table = useMantineReactTable({
    columns,
    data: invoices,
    enableGrouping: true,
    initialState: {
      grouping: ['counterparty'],
      expanded: true,
    },
    enableSorting: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    state: {
      isLoading: false,
    },
    mantineTableBodyRowProps: ({ row }) => {
      if (row.getIsGrouped()) {
        return {
          style: {
            borderTop: '2px solid var(--mantine-color-gray-4)',
            borderBottom: '2px solid var(--mantine-color-gray-4)',
            backgroundColor: 'var(--mantine-color-gray-0)',
            cursor: 'pointer',
          } as React.CSSProperties,
        };
      }
      if (highlightedIds.includes(row.original.id)) {
        return {
          style: { backgroundColor: 'var(--mantine-color-yellow-0)' } as React.CSSProperties,
        };
      }
      return {};
    },
    renderEmptyRowsFallback: () => <Text p="md" c="dimmed">Нет счетов за эту дату</Text>,
  });

  return <MantineReactTable table={table} />;
}
