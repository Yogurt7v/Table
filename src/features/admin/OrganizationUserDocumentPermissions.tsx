import { useEffect, useState } from 'react';
import { Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOrganizationUserModulePermissions } from '@/api/module-permissions';
import type { IOrganizationUser } from '@/shared/types';

const DOCUMENT_FLAG_KEYS = ['can_view_documents'] as const satisfies readonly (keyof IOrganizationUser)[];

function readDocumentFlags(assignment: IOrganizationUser | null) {
  return {
    can_view_documents: assignment?.can_view_documents === true,
  };
}

interface OrganizationUserDocumentPermissionsProps {
  assignment: IOrganizationUser;
  canEdit: boolean;
  onSaved?: () => void;
  onClose?: () => void;
}

export function OrganizationUserDocumentPermissions({
  assignment,
  canEdit,
  onSaved,
  onClose,
}: OrganizationUserDocumentPermissionsProps) {
  const queryClient = useQueryClient();
  const serverFlags = readDocumentFlags(assignment);
  const serverSignature = DOCUMENT_FLAG_KEYS.map((key) => String(serverFlags[key])).join('');
  const [draft, setDraft] = useState(serverFlags);
  const [syncedSignature, setSyncedSignature] = useState(serverSignature);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (serverSignature === syncedSignature) return;
    setSyncedSignature(serverSignature);
    setDraft(serverFlags);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [serverSignature, syncedSignature, serverFlags]);

  const save = useMutation({
    mutationFn: (flags: Record<string, boolean>) =>
      updateOrganizationUserModulePermissions(assignment.id, flags),
    onMutate: async (flags) => {
      await queryClient.cancelQueries({ queryKey: ['organization_users'] });
      const previous = queryClient.getQueriesData<IOrganizationUser[]>({
        queryKey: ['organization_users'],
      });
      queryClient.setQueriesData<IOrganizationUser[]>(
        { queryKey: ['organization_users'] },
        (rows) => rows?.map((row) => (row.id === assignment.id ? { ...row, ...flags } : row)),
      );
      return { previous };
    },
    onSuccess: () => {
      notifications.show({
        color: 'green',
        title: 'Права на документы сохранены',
        message: 'Новые права действуют сразу.',
      });
      onSaved?.();
    },
    onError: (_error, _flags, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      setDraft(serverFlags);
      notifications.show({
        color: 'red',
        message: 'Не удалось сохранить права на документы',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['organization_users'] }),
  });

  const isDirty = DOCUMENT_FLAG_KEYS.some((key) => draft[key] !== serverFlags[key]);

  const setFlag = (key: string, value: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    save.mutate(draft);
  };

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>Права на документы</Text>

      <Checkbox
        label="Видеть документы"
        size="xs"
        checked={draft.can_view_documents}
        disabled={!canEdit}
        onChange={(event) => setFlag('can_view_documents', event.currentTarget.checked)}
      />

      {!canEdit && (
        <Text size="xs" c="orange">
          Изменять может только администратор
        </Text>
      )}

      {canEdit && (
        <Group justify="flex-end" gap={6}>
          <Button size="compact-xs" variant="light" onClick={() => { setDraft(serverFlags); onClose?.(); }}>
            Отмена
          </Button>
          <Button
            size="compact-xs"
            onClick={handleSave}
            loading={save.isPending}
            disabled={!isDirty}
          >
            Сохранить
          </Button>
        </Group>
      )}
    </Stack>
  );
}
