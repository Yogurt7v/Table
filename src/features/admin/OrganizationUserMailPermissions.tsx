import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Group, Stack, Table, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOrganizationUserMailPermissions } from '@/api/mail';
import { getMailPermissions } from '@/features/mail/mail-field-access';
import type { IOrganizationUser, MailPermissionFlags } from '@/shared/types';

/** The seven authoritative columns, in the order they are written back. */
const MAIL_FLAG_KEYS = [
  'can_view_mails',
  'can_create_incoming_mails',
  'can_edit_incoming_mails',
  'can_delete_incoming_mails',
  'can_create_outgoing_mails',
  'can_edit_outgoing_mails',
  'can_delete_outgoing_mails',
] as const satisfies readonly (keyof MailPermissionFlags)[];

/**
 * Rows of the direction matrix. Each cell is a single column name, so the grid
 * stays declarative and the write payload is assembled from the same keys.
 */
const MAIL_DIRECTIONS = [
  {
    label: 'Входящие',
    create: 'can_create_incoming_mails',
    edit: 'can_edit_incoming_mails',
    remove: 'can_delete_incoming_mails',
  },
  {
    label: 'Исходящие',
    create: 'can_create_outgoing_mails',
    edit: 'can_edit_outgoing_mails',
    remove: 'can_delete_outgoing_mails',
  },
] as const satisfies readonly {
  label: string;
  create: keyof MailPermissionFlags;
  edit: keyof MailPermissionFlags;
  remove: keyof MailPermissionFlags;
}[];

const COLUMN_LABELS = ['Создание', 'Редактирование', 'Удаление'] as const;

/**
 * Reads the seven columns into the write shape. Coercion is delegated to
 * `getMailPermissions` so this screen can never disagree with the runtime
 * gating: a membership from an unbackfilled collection yields `false`
 * everywhere, never `true`.
 */
function readMailFlags(assignment: IOrganizationUser | null): MailPermissionFlags {
  const permissions = getMailPermissions(assignment);
  return {
    can_view_mails: permissions.canView,
    can_create_incoming_mails: permissions.canCreateIncoming,
    can_edit_incoming_mails: permissions.canEditIncoming,
    can_delete_incoming_mails: permissions.canDeleteIncoming,
    can_create_outgoing_mails: permissions.canCreateOutgoing,
    can_edit_outgoing_mails: permissions.canEditOutgoing,
    can_delete_outgoing_mails: permissions.canDeleteOutgoing,
  };
}

interface OrganizationUserMailPermissionsProps {
  /** The membership being edited; its `id` is the `organization_users` row. */
  assignment: IOrganizationUser;
  /** False renders the matrix disabled with the read-only notice. */
  canEdit: boolean;
  /** Called after a successful write, so the host can close its popover. */
  onSaved?: () => void;
}

export function OrganizationUserMailPermissions({
  assignment,
  canEdit,
  onSaved,
}: OrganizationUserMailPermissionsProps) {
  const queryClient = useQueryClient();
  const serverFlags = readMailFlags(assignment);
  const serverSignature = MAIL_FLAG_KEYS.map((key) => String(serverFlags[key])).join('');
  const [draft, setDraft] = useState<MailPermissionFlags>(serverFlags);
  const [syncedSignature, setSyncedSignature] = useState(serverSignature);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (serverSignature === syncedSignature) return;
    setSyncedSignature(serverSignature);
    setDraft(serverFlags);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [serverSignature, syncedSignature, serverFlags]);

  const save = useMutation({
    mutationFn: (flags: MailPermissionFlags) =>
      updateOrganizationUserMailPermissions(assignment.id, flags),
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
        title: 'Почтовые права сохранены',
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
        message: 'Не удалось сохранить почтовые права',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['organization_users'] }),
  });

  const isDirty = MAIL_FLAG_KEYS.some((key) => draft[key] !== serverFlags[key]);

  const setFlag = (key: keyof MailPermissionFlags, value: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleCancel = () => {
    setDraft(serverFlags);
  };

  const handleSave = () => {
    save.mutate(draft);
  };

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>
        Почтовые права
      </Text>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" p="xs">
        <Text size="xs" style={{ textWrap: 'pretty' }}>
          Почтовые права задаются отдельно от роли и действуют именно на них. Роль определяет доступ
          к счетам, флаги — к почте. У пользователя без флага «Видеть почту» раздел «Почта» не
          отображается.
        </Text>
      </Alert>

      <Checkbox
        label="Видеть почту"
        size="xs"
        checked={draft.can_view_mails}
        disabled={!canEdit}
        onChange={(event) => setFlag('can_view_mails', event.currentTarget.checked)}
      />

      <Table fz="xs" w="100%" horizontalSpacing={6} withRowBorders={false} verticalSpacing={2}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Направление</Table.Th>
            {COLUMN_LABELS.map((label) => (
              <Table.Th key={label} style={{ textAlign: 'center' }}>
                {label}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {MAIL_DIRECTIONS.map((direction) => (
            <Table.Tr key={direction.label}>
              <Table.Td>
                <Text size="xs" fw={500}>
                  {direction.label}
                </Text>
              </Table.Td>
              {(
                [
                  [direction.create, 'создание'],
                  [direction.edit, 'редактирование'],
                  [direction.remove, 'удаление'],
                ] as const
              ).map(([key, action]) => (
                <Table.Td key={action} style={{ textAlign: 'center' }}>
                  <Checkbox
                    size="xs"
                    aria-label={`${direction.label}: ${action}`}
                    checked={draft[key]}
                    disabled={!canEdit}
                    onChange={(event) => setFlag(key, event.currentTarget.checked)}
                  />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {!canEdit && (
        <Text size="xs" c="orange">
          Изменять может только администратор
        </Text>
      )}

      {canEdit && (
        <Group justify="flex-end" gap={6}>
          <Button size="compact-xs" variant="light" onClick={handleCancel} disabled={!isDirty}>
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
