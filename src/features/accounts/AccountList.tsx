import { useState, useRef } from 'react';
import { Paper, Title, Table, Loader, Text, Group, TextInput, ActionIcon } from '@mantine/core';
import { IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import sumBy from 'lodash/sumBy';
// import dayjs from 'dayjs';
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

function cleanInput(raw: string): string {
  let result = '';
  let hasDecimal = false;
  let decimalDigits = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === ' ') continue;
    if (ch >= '0' && ch <= '9') {
      if (hasDecimal && decimalDigits >= 2) continue;
      result += ch;
      if (hasDecimal) decimalDigits++;
    } else if ((ch === '.' || ch === ',') && !hasDecimal) {
      hasDecimal = true;
      result += ',';
    }
  }
  return result;
}

function formatForDisplay(value: string): string {
  const commaIdx = value.indexOf(',');
  if (commaIdx === -1) {
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  const intPart = value.slice(0, commaIdx);
  const decPart = value.slice(commaIdx + 1);
  const spaced = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${spaced},${decPart}`;
}

function parseToNumber(value: string): number {
  const num = parseFloat(value.replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const total = accounts ? sumBy(accounts, 'balance') : 0;

  const startEdit = (item: IAccountWithBalance) => {
    setEditingId(item.account.id);
    setEditInput(item.balance.toFixed(2).replace('.', ','));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const balance = parseToNumber(editInput);
    await updateBalance.mutateAsync({ accountId: editingId, date, balance });
    setEditingId(null);
  };

  if (currentRole && !canEdit && currentRole !== 'boss') return null;
  // const isToday = date === dayjs().format('YYYY-MM-DD');
  const canEditHere = canEdit; // && isToday

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
                      <TextInput
                        ref={inputRef}
                        size="xs"
                        value={formatForDisplay(editInput)}
                        onChange={(e) => {
                          const pos = e.target.selectionStart ?? editInput.length;
                          const raw = e.currentTarget.value;
                          const oldRaw = editInput;
                          const cleaned = cleanInput(raw);
                          if (cleaned === oldRaw) {
                            requestAnimationFrame(() => {
                              inputRef.current?.setSelectionRange(pos, pos);
                            });
                            return;
                          }

                          const oldFormatted = formatForDisplay(oldRaw);
                          const newFormatted = formatForDisplay(cleaned);
                          let nonSpace = 0;
                          for (let i = 0; i < oldFormatted.length && i < pos; i++) {
                            if (oldFormatted[i] !== ' ') nonSpace++;
                          }

                          setEditInput(cleaned);

                          requestAnimationFrame(() => {
                            if (!inputRef.current) return;
                            let count = 0;
                            let newPos = newFormatted.length;
                            for (let i = 0; i < newFormatted.length; i++) {
                              if (newFormatted[i] !== ' ') count++;
                              if (count > nonSpace) { newPos = i; break; }
                            }
                            inputRef.current.setSelectionRange(newPos, newPos);
                          });
                        }}
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
