import { Anchor, Badge, Group, Paper, Table, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconSearchOff } from '@tabler/icons-react';
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
        Результаты поиска: «{searchText}»
      </Title>
      {searchResults.length === 0 ? (
        <Group justify="center" gap="xs" py="md" wrap="nowrap">
          <IconSearchOff size={20} style={{ color: 'var(--mantine-color-gray-5)' }} />
          <Text c="dimmed">Ничего не найдено</Text>
        </Group>
      ) : (
        <Table highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Дата</Table.Th>
              <Table.Th>Контрагент</Table.Th>
              <Table.Th>Назначение</Table.Th>
              <Table.Th ta="right">Сумма</Table.Th>
              <Table.Th>Статус</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {searchResults.map((inv) => (
              <Table.Tr key={inv.id}>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  {dayjs(inv.date).format('DD.MM.YYYY')}
                </Table.Td>
                <Table.Td>{inv.counterparty}</Table.Td>
                <Table.Td>{inv.purpose}</Table.Td>
                <Table.Td ta="right">{formatAmountRub(inv.amount)}</Table.Td>
                <Table.Td>
                  {inv.paid ? (
                    <Badge color="green" variant="light">
                      Оплачено
                    </Badge>
                  ) : (
                    <Badge color="orange" variant="light">
                      Ожидает
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Anchor
        component="button"
        type="button"
        size="xs"
        mt={8}
        onClick={onBackToDate}
        leftSection={<IconArrowLeft size={14} />}
      >
        Вернуться к {dayjs(date).format('DD.MM.YYYY')}
      </Anchor>
    </Paper>
  );
}
