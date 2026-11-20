import { Badge, Button, Group, Paper, Table, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconSearchOff } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { getEffectiveAmount } from '@/shared/utils/invoice-utils';
import type { IInvoice } from '@/shared/types';

interface SearchResultsViewProps {
  searchText: string;
  searchResults: IInvoice[];
  date: string;
  canViewPaidDate: boolean;
  onBackToDate: () => void;
  onOpenInvoice: (invoice: IInvoice) => void;
}

/**
 * Результаты поиска по всем счетам организации: таблица с датой добавления,
 * контрагентом, суммой, статусом, датой оплаты (если доступна) и назначением.
 * Клик по строке открывает счёт в реестре.
 */
export function SearchResultsView({
  searchText,
  searchResults,
  date,
  canViewPaidDate,
  onBackToDate,
  onOpenInvoice,
}: SearchResultsViewProps) {
  // Шапка с заголовком и таблица результатов либо пустое состояние
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
              <Table.Th>Дата добавления</Table.Th>
              <Table.Th>Контрагент</Table.Th>
              <Table.Th ta="right">Сумма</Table.Th>
              <Table.Th>Статус</Table.Th>
              {canViewPaidDate && <Table.Th>Дата оплаты</Table.Th>}
              <Table.Th>Назначение</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {/* Строка открывает счёт в реестре: клик мышью или Enter/Space с клавиатуры */}
            {searchResults.map((inv) => (
              <Table.Tr
                key={inv.id}
                onClick={(event) => {
                  // Гасим document-click реестра, иначе он сразу сотрёт запрошенную подсветку.
                  event.stopPropagation();
                  onOpenInvoice(inv);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenInvoice(inv);
                  }
                }}
                tabIndex={0}
                style={{ cursor: 'pointer' }}
              >
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  {dayjs(inv.date).format('DD.MM.YYYY')}
                </Table.Td>
                <Table.Td>{inv.counterparty}</Table.Td>
                <Table.Td ta="right">{formatAmountRub(getEffectiveAmount(inv))}</Table.Td>
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
                {canViewPaidDate && (
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    {inv.paid_date ? (
                      <Text component="span" fw={700}>
                        {dayjs(inv.paid_date).format('DD.MM.YYYY')}
                      </Text>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                )}
                <Table.Td>
                  <div
                    title={inv.purpose}
                    style={{
                      maxWidth: 280,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {inv.purpose}
                  </div>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Button
        variant="subtle"
        size="xs"
        mt={8}
        onClick={onBackToDate}
        leftSection={<IconArrowLeft size={14} />}
      >
        Вернуться к {dayjs(date).format('DD.MM.YYYY')}
      </Button>
    </Paper>
  );
}
