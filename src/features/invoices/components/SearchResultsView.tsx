import { Paper, Title, Text, Table } from '@mantine/core';
import dayjs from 'dayjs';
import { formatAmountRub } from '@/shared/utils/format-currency';
import type { IInvoice } from '@/shared/types';

interface SearchResultsViewProps {
  searchText: string;
  searchResults: IInvoice[];
  date: string;
  onBackToDate: () => void;
}

export function SearchResultsView({
  searchText,
  searchResults,
  date,
  onBackToDate,
}: SearchResultsViewProps) {
  return (
    <Paper withBorder p="sm">
      <Title order={5} mb="sm">
        Результаты поиска: "{searchText}"
      </Title>
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
                <Table.Td>{formatAmountRub(inv.amount)}</Table.Td>
                <Table.Td>{inv.paid ? 'Оплачено' : 'Ожидает'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Text size="xs" c="blue" style={{ cursor: 'pointer', marginTop: 8 }} onClick={onBackToDate}>
        ← Вернуться к {dayjs(date).format('DD.MM.YYYY')}
      </Text>
    </Paper>
  );
}
