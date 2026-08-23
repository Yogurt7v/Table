import { useState } from 'react';
import { Group, Stack, Button, TextInput, Text, ActionIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import { createBankAccount, deleteBankAccount, updateBankAccount } from '@/api/collections';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { IBankAccount } from '@/shared/types';

interface BankAccountManagerProps {
  organizationId: string;
  accounts: IBankAccount[];
}

export function BankAccountManager({ organizationId, accounts }: BankAccountManagerProps) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['bank_accounts'] });
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createBankAccount(organizationId, newName.trim());
      setNewName('');
      refresh();
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось добавить счёт' });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateBankAccount(id, editName.trim());
      setEditingId(null);
      refresh();
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось сохранить счёт' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBankAccount(id);
      refresh();
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось удалить счёт' });
    }
  };

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        Расчётные счета
      </Text>

      {accounts.length === 0 && (
        <Text size="xs" c="dimmed">
          Нет счетов
        </Text>
      )}

      {accounts.map((acc) => (
        <Group key={acc.id} gap={6} wrap="nowrap">
          {editingId === acc.id ? (
            <>
              <TextInput
                size="xs"
                value={editName}
                onChange={(e) => setEditName(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <ActionIcon
                size="sm"
                color="green"
                variant="light"
                onClick={() => handleUpdate(acc.id)}
              >
                <IconCheck size={14} />
              </ActionIcon>
              <ActionIcon
                size="sm"
                color="gray"
                variant="subtle"
                onClick={() => setEditingId(null)}
              >
                <IconX size={14} />
              </ActionIcon>
            </>
          ) : (
            <>
              <Text size="sm" style={{ flex: 1 }} truncate>
                {acc.account_number}
              </Text>
              <ActionIcon
                size="sm"
                color="blue"
                variant="subtle"
                onClick={() => {
                  setEditingId(acc.id);
                  setEditName(acc.account_number);
                }}
              >
                <IconPencil size={14} />
              </ActionIcon>
              <ActionIcon
                size="sm"
                color="red"
                variant="subtle"
                onClick={() => setDeleteTarget({ id: acc.id, name: acc.account_number })}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </>
          )}
        </Group>
      ))}

      <Group gap={6} wrap="nowrap">
        <TextInput
          size="xs"
          placeholder="Название счёта"
          value={newName}
          onChange={(e) => setNewName(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button size="compact-xs" onClick={handleAdd} disabled={!newName.trim()}>
          Добавить
        </Button>
      </Group>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            handleDelete(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        title="Удаление счёта"
        message={`Удалить расчётный счёт «${deleteTarget?.name ?? ''}»?`}
      />
    </Stack>
  );
}
