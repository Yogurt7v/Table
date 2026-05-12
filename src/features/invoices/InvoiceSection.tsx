import { useMemo } from 'react';
import { Paper, Title, Button, Group, Loader, Text, Table } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { useInvoices } from '@/shared/hooks/useInvoices';
import { useSearchInvoices } from '@/shared/hooks/useSearchInvoices';
import { InvoiceTable } from '@/features/invoices/InvoiceTable';
import type { IInvoice } from '@/shared/types';

interface InvoiceSectionProps {
  orgId: string;
  date: string;
  searchText: string;
  searchAll: boolean;
  onBackToDate: () => void;
}

function computeHighlightedIds(
  searchText: string,
  searchResults: IInvoice[] | undefined,
  invoices: IInvoice[] | undefined,
): string[] {
  if (!searchText) return [];
  if (searchResults) return searchResults.map((i) => i.id);
  if (!invoices) return [];

  const lower = searchText.toLowerCase();
  return invoices
    .filter(
      (inv) =>
        inv.counterparty.toLowerCase().includes(lower) ||
        inv.purpose.toLowerCase().includes(lower) ||
        inv.contract_no.toLowerCase().includes(lower) ||
        inv.invoice_no.toLowerCase().includes(lower) ||
        inv.comment.toLowerCase().includes(lower) ||
        String(inv.amount).includes(lower),
    )
    .map((i) => i.id);
}

export function InvoiceSection({ orgId, date, searchText, searchAll, onBackToDate }: InvoiceSectionProps) {
  const { data: objects } = useAccountingObjects(orgId);
  const { data: invoices } = useInvoices(orgId, date);
  const { data: searchResults } = useSearchInvoices(orgId);

  const highlightedIds = useMemo(
    () => computeHighlightedIds(searchText, searchResults, invoices),
    [searchText, searchResults, invoices],
  );

  if (!orgId) return null;

  if (searchAll && searchResults) {
    return (
      <Paper withBorder p="sm">
        <Title order={5} mb="sm">Результаты поиска: "{searchText}"</Title>
        {searchResults.length === 0 ? (
          <Text c="dimmed">Ничего не найдено</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Дата</Table.Th>
                <Table.Th>Контрагент</Table.Th>
                <Table.Th>Назначение</Table.Th>
                <Table.Th>Сумма</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {searchResults.map((inv) => (
                <Table.Tr key={inv.id}>
                  <Table.Td>{dayjs(inv.date).format('DD.MM.YYYY')}</Table.Td>
                  <Table.Td>{inv.counterparty}</Table.Td>
                  <Table.Td>{inv.purpose}</Table.Td>
                  <Table.Td>{inv.amount.toLocaleString()} ₽</Table.Td>
                  <Table.Td>{inv.paid ? 'Оплачено' : 'Ожидает'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <Text
          size="xs"
          c="blue"
          style={{ cursor: 'pointer', marginTop: 8 }}
          onClick={onBackToDate}
        >
          ← Вернуться к {dayjs(date).format('DD.MM.YYYY')}
        </Text>
      </Paper>
    );
  }

  if (!objects) return <Loader />;

  return objects?.map((obj) => {
    const objInvoices = invoices?.filter((i) => i.accounting_object_id === obj.id) ?? [];
    return (
      <Paper key={obj.id} withBorder p="sm">
        <Group justify="space-between" mb="sm">
          <Title order={5}>{obj.name}</Title>
          <Button size="compact-xs" variant="light" leftSection={<IconPlus size={14} />}>
            Добавить счёт
          </Button>
        </Group>
        {!invoices ? (
          <Loader size="sm" />
        ) : (
          <InvoiceTable invoices={objInvoices} highlightedIds={highlightedIds} />
        )}
      </Paper>
    );
  });
}
