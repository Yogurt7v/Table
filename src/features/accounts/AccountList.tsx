import { Paper, Title, Table, Loader } from '@mantine/core';
import type { IBankAccount } from '@/shared/types';

interface AccountListProps {
  accounts: IBankAccount[] | undefined;
  loading: boolean;
}

export function AccountList({ accounts, loading }: AccountListProps) {
  return (
    <Paper withBorder p="sm">
      <Title order={6} mb="xs">Расчётные счета</Title>
      {loading ? (
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
  );
}
