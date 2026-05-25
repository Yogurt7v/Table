import { useState } from 'react';
import { Paper, Title, Table, Loader, Text, Group, NumberInput, ActionIcon } from '@mantine/core';
import { IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import sumBy from 'lodash/sumBy';
import dayjs from 'dayjs';
import { useAuth } from '@/shared/context/AuthContext';
import { useOrg } from '@/shared/context/OrgContext';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import { useUpdateBalance } from '@/shared/hooks/useBankAccounts';
import type { IAccountWithBalance } from '@/shared/types';

interface AccountListProps {
  accounts: IAccountWithBalance[] | undefined;
  loading: boolean;
  date: string;
}

function toFixed2(n: number) {
  const parts = n.toFixed(2).split('.');
  const spaced = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${spaced}.${parts[1]} ₽`;
}

export function AccountList({ accounts, loading, date }: AccountListProps) {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: orgUsers } = useOrganizationUsers();
  const updateBalance = useUpdateBalance();

  const currentRole = orgUsers?.find(
    (ou) => ou.user_id === user?.id && ou.organization_id === currentOrgId,
  )?.role;
  const canEdit = currentRole === 'admin' || currentRole === 'moderator';
  const isToday = date === dayjs().format('YYYY-MM-DD');
  const canEditHere = canEdit && isToday;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const total = accounts ? sumBy(accounts, 'balance') : 0;

  const startEdit = (item: IAccountWithBalance) => {
    setEditingId(item.account.id);
    setEditValue(item.balance);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateBalance.mutateAsync({ accountId: editingId, date, balance: editValue });
    setEditingId(null);
  };

  return (
    <Paper withBorder p="sm" w="50%">
      <Title order={6} mb="xs">
        Расчётные счета
      </Title>
      {loading ? (
        <Loader size="sm" />
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Счёт</Table.Th>
              <Table.Th ta="right">Остаток</Table.Th>
              {canEditHere && <Table.Th w={60} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {accounts?.map((item) => (
              <Table.Tr key={item.account.id}>
                <Table.Td>{item.account.account_number}</Table.Td>
                <Table.Td ta="right">
                  {editingId === item.account.id ? (
                    <div style={{ width: '50%', marginLeft: 'auto' }}>
                      <NumberInput
                        size="xs"
                        value={editValue}
                        onChange={(v) => {
                          if (typeof v === 'string') {
                            const cleaned = v.replace(/\s/g, '').replace(',', '.');
                            setEditValue(parseFloat(cleaned) || 0);
                          } else {
                            setEditValue(v);
                          }
                        }}
                        decimalScale={2}
                        // fixedDecimalScale
                        thousandSeparator=" "
                        styles={{ input: { textAlign: 'right' } }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                    </div>
                  ) : (
                    <Text>{toFixed2(item.balance)}</Text>
                  )}
                </Table.Td>
                {canEditHere && (
                  <Table.Td>
                    {editingId === item.account.id ? (
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon
                          size="sm"
                          color="green"
                          variant="light"
                          onClick={saveEdit}
                          loading={updateBalance.isPending}
                        >
                          <IconCheck size={14} />
                        </ActionIcon>
                        <ActionIcon size="sm" color="gray" variant="subtle" onClick={cancelEdit}>
                          <IconX size={14} />
                        </ActionIcon>
                      </Group>
                    ) : (
                      <ActionIcon
                        size="sm"
                        color="blue"
                        variant="subtle"
                        onClick={() => startEdit(item)}
                      >
                        <IconPencil size={14} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr>
              <Table.Td colSpan={2}>
                <Group justify="flex-end" gap="xs">
                  <Text fw={700}>ИТОГО</Text>
                  <Text fw={700}>{toFixed2(total)}</Text>
                </Group>
              </Table.Td>
              {canEditHere && <Table.Td />}
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      )}
    </Paper>
  );
}
