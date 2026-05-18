import { useState } from 'react';
import { Group, Stack, Button, TextInput, Text, ActionIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import {
  createAccountingObject,
  deleteAccountingObject,
  updateAccountingObject,
} from '@/api/collections';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { IAccountingObject } from '@/shared/types';

interface AccountingObjectManagerProps {
  organizationId: string;
  objects: IAccountingObject[];
  canEdit: boolean;
}

export function AccountingObjectManager({
  organizationId,
  objects,
  canEdit,
}: AccountingObjectManagerProps) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['accounting_objects'] });
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createAccountingObject(organizationId, newName.trim());
    setNewName('');
    refresh();
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    await updateAccountingObject(id, editName.trim());
    setEditingId(null);
    refresh();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAccountingObject(id);
      refresh();
    } catch {
      notifications.show({
        color: 'red',
        message: 'Нельзя удалить: в объекте есть счета',
      });
    }
  };

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        Объекты учёта
      </Text>

      {objects.length === 0 && (
        <Text size="xs" c="dimmed">
          Нет объектов
        </Text>
      )}

      {objects.map((obj) => (
        <Group key={obj.id} gap={6} wrap="nowrap">
          {canEdit && editingId === obj.id ? (
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
                onClick={() => handleUpdate(obj.id)}
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
                {obj.name}
              </Text>
              {canEdit && (
                <>
                  <ActionIcon
                    size="sm"
                    color="blue"
                    variant="subtle"
                    onClick={() => {
                      setEditingId(obj.id);
                      setEditName(obj.name);
                    }}
                  >
                    <IconPencil size={14} />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="subtle"
                    onClick={() => setDeleteTarget({ id: obj.id, name: obj.name })}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </>
              )}
            </>
          )}
        </Group>
      ))}

      {canEdit && (
        <Group gap={6} wrap="nowrap">
          <TextInput
            size="xs"
            placeholder="Название объекта"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button size="compact-xs" onClick={handleAdd} disabled={!newName.trim()}>
            Добавить
          </Button>
        </Group>
      )}

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void handleDelete(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        title="Удаление объекта"
        message={`Удалить объект «${deleteTarget?.name ?? ''}»?`}
      />
    </Stack>
  );
}
