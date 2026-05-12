import { useState } from 'react';
import { Container, Title, Paper, Table, Text, Badge, Stack, Loader } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useOrg } from '@/shared/context/OrgContext';
import { useBankAccounts } from '@/shared/hooks/useBankAccounts';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { useInvoices } from '@/shared/hooks/useInvoices';

export function MainPage() {
  const { currentOrgId } = useOrg();
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = dayjs(date).format('YYYY-MM-DD');

  const { data: accounts, isLoading: accountsLoading } = useBankAccounts(currentOrgId);
  const { data: objects, isLoading: objectsLoading } = useAccountingObjects(currentOrgId);
  const { data: invoices, isLoading: invoicesLoading } = useInvoices(currentOrgId, dateStr);

  if (!currentOrgId) return <Loader />;

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <DatePickerInput
          leftSection={<IconCalendar size={16} />}
          value={date}
          onChange={(v) => v && setDate(v)}
          w={280}
        />

        <Paper withBorder p="sm">
          <Title order={6} mb="xs">Расчётные счета</Title>
          {accountsLoading ? (
            <Loader size="sm" />
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Счёт</Table.Th>
                  <Table.Th>Остаток</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {accounts?.map((a) => (
                  <Table.Tr key={a.id}>
                    <Table.Td>{a.account_number}</Table.Td>
                    <Table.Td>{a.balance.toLocaleString()} ₽</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {objectsLoading ? (
          <Loader />
        ) : (
          objects?.map((obj) => {
            const objInvoices = invoices?.filter((i) => i.accounting_object_id === obj.id) ?? [];
            return (
              <Paper key={obj.id} withBorder p="sm">
                <Title order={5} mb="sm">{obj.name}</Title>
                {invoicesLoading ? (
                  <Loader size="sm" />
                ) : objInvoices.length === 0 ? (
                  <Text c="dimmed" size="sm">Нет счетов на эту дату</Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>№</Table.Th>
                        <Table.Th>Контрагент</Table.Th>
                        <Table.Th>Назначение</Table.Th>
                        <Table.Th>Договор</Table.Th>
                        <Table.Th>Счёт</Table.Th>
                        <Table.Th>Сумма</Table.Th>
                        <Table.Th>Оплачено</Table.Th>
                        <Table.Th>Дата оплаты</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {objInvoices.map((inv) => (
                        <Table.Tr key={inv.id}>
                          <Table.Td>{inv.seq}</Table.Td>
                          <Table.Td>{inv.counterparty}</Table.Td>
                          <Table.Td>{inv.purpose}</Table.Td>
                          <Table.Td>{inv.contract_no}</Table.Td>
                          <Table.Td>{inv.invoice_no}</Table.Td>
                          <Table.Td>{inv.amount.toLocaleString()} ₽</Table.Td>
                          <Table.Td>
                            <Badge color={inv.paid ? 'green' : 'orange'}>
                              {inv.paid ? 'Да' : 'Нет'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{inv.paid_date || '—'}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            );
          })
        )}
      </Stack>
    </Container>
  );
}
