import { useState, useRef } from 'react';
import {
  Paper,
  Title,
  Text,
  Group,
  Stack,
  TextInput,
  ActionIcon,
  Skeleton,
  Box,
  Divider,
} from '@mantine/core';
import { IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import { useUpdateBalance } from '@/shared/hooks/useBankAccounts';
import type { IAccountWithBalance } from '@/shared/types';
import { toFixed2, cleanInput, formatForDisplay, parseToNumber } from './account-balance-input';

interface AccountListMobileProps {
  accounts: IAccountWithBalance[] | undefined;
  loading: boolean;
  date: string;
  canEdit: boolean;
}

export function AccountListMobile({ accounts, loading, date, canEdit }: AccountListMobileProps) {
  const updateBalance = useUpdateBalance();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

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
    try {
      await updateBalance.mutateAsync({ accountId: editingId, date, balance });
      setEditingId(null);
    } catch {
      /* тост об ошибке показывает onError в useUpdateBalance */
    }
  };

  const total = accounts?.reduce((s, a) => s + a.balance, 0) ?? 0;

  return (
    <Paper
      radius="md"
      p="xs"
      style={{ backgroundColor: 'var(--mantine-color-body)', boxShadow: 'var(--mantine-shadow-sm)' }}
    >
      <Title order={6} mb="xs" px="xs">
        Расчётные счета
      </Title>
      {loading ? (
        <Stack gap="xs">
          <Skeleton height={44} radius="sm" />
          <Skeleton height={44} radius="sm" />
        </Stack>
      ) : (
        <Stack gap={2}>
          {accounts?.map((item) => (
            <Box
              key={item.account.id}
              py="sm"
              px="xs"
              style={{
                borderRadius: 8,
                transition: 'background-color 0.15s',
                cursor: canEdit ? 'pointer' : 'default',
                ...(editingId === item.account.id && {
                  backgroundColor: 'var(--mantine-color-blue-light)',
                  boxShadow: 'inset 0 0 0 1px var(--mantine-color-blue-3)',
                }),
              }}
            >
              {editingId === item.account.id ? (
                <Group gap="xs" wrap="nowrap">
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
                  <ActionIcon
                    size="sm"
                    color="green"
                    variant="light"
                    aria-label="Сохранить остаток"
                    onClick={saveEdit}
                    loading={updateBalance.isPending}
                  >
                    <IconCheck size={14} />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    color="gray"
                    variant="subtle"
                    aria-label="Отмена"
                    onClick={cancelEdit}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              ) : (
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Text size="sm" tt="uppercase" c="dimmed" truncate>
                    {item.account.account_number}
                  </Text>
                  <Group gap={4} wrap="nowrap" justify="flex-end" style={{ flexShrink: 0 }}>
                    <Text
                      size="sm"
                      fw={700}
                      style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {toFixed2(item.balance)}
                    </Text>
                    {canEdit && (
                      <ActionIcon
                        size="sm"
                        color="blue"
                        variant="subtle"
                        aria-label="Редактировать остаток"
                        onClick={() => startEdit(item)}
                      >
                        <IconPencil size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                </Group>
              )}
            </Box>
          ))}
          <Divider my={4} />
          <Box ta="right" py="xs" px="xs">
            <Group justify="space-between" gap="xs" wrap="nowrap">
              <Text fw={400}>ИТОГО</Text>
              <Text fw={400} style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {toFixed2(total)}
              </Text>
            </Group>
          </Box>
        </Stack>
      )}
    </Paper>
  );
}
