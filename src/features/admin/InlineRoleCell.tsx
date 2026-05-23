import { useState } from 'react';
import { Group, Stack, Select, Button, Text, Badge, ActionIcon } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import {
  useCreateOrganizationUser,
  useDeleteOrganizationUser,
} from '@/shared/hooks/useOrganizationUsers';
import { useOrg } from '@/shared/context/OrgContext';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { IOrganizationUser } from '@/shared/types';

const ROLE_COLORS: Record<IOrganizationUser['role'], string> = {
  admin: 'red',
  moderator: 'blue',
  user: 'green',
  boss: 'teal',
  guest: 'gray',
};

const ROLE_LABELS: Record<IOrganizationUser['role'], string> = {
  admin: 'Администратор',
  moderator: 'Модератор',
  user: 'Пользователь',
  boss: 'Босс',
  guest: 'Гость',
};

interface InlineRoleCellProps {
  userId: string;
  assignments: IOrganizationUser[];
}

export function InlineRoleCell({ userId, assignments }: InlineRoleCellProps) {
  const createOrgUser = useCreateOrganizationUser();
  const deleteOrgUser = useDeleteOrganizationUser();
  const { organizations } = useOrg();
  const [showForm, setShowForm] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<IOrganizationUser['role']>('guest');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; orgName: string } | null>(null);

  const availableOrgs = organizations.filter(
    (o) => !assignments.some((a) => a.organization_id === o.id),
  );

  const handleAdd = async () => {
    if (!selectedOrg) return;
    await createOrgUser.mutateAsync({ userId, organizationId: selectedOrg, role: selectedRole });
    setSelectedOrg(null);
    setSelectedRole('guest');
  };

  const handleRemove = async (id: string) => {
    await deleteOrgUser.mutateAsync(id);
  };

  return (
    <>
      <Stack gap={4}>
        {assignments.length === 0 && !availableOrgs.length && (
          <Text size="sm" c="dimmed">
            Нет ролей
          </Text>
        )}

        {assignments.map((a) => {
          const orgName =
            organizations.find((o) => o.id === a.organization_id)?.name ?? a.organization_id;
          return (
            <Group key={a.id} gap={4} wrap="nowrap">
              <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" truncate>
                  {orgName}
                </Text>
                <Badge color={ROLE_COLORS[a.role]} size="sm" variant="light">
                  {ROLE_LABELS[a.role]}
                </Badge>
              </Group>
              <ActionIcon
                size="md"
                color="red"
                variant="subtle"
                onClick={() => setDeleteTarget({ id: a.id, orgName })}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          );
        })}

        {showForm && (
          <Group gap={6} wrap="nowrap">
            <Select
              data={availableOrgs.map((o) => ({ value: o.id, label: o.name }))}
              value={selectedOrg}
              onChange={setSelectedOrg}
              placeholder="Организация"
              size="xs"
              style={{ flex: 1, minWidth: 0 }}
              comboboxProps={{ withinPortal: false }}
            />
            <Select
              data={[
                { value: 'admin', label: 'Админ' },
                { value: 'moderator', label: 'Модератор' },
                { value: 'user', label: 'Пользователь' },
                { value: 'boss', label: 'Босс' },
                { value: 'guest', label: 'Гость' },
              ]}
              value={selectedRole}
              onChange={(v) => v && setSelectedRole(v as IOrganizationUser['role'])}
              size="xs"
              w={110}
              comboboxProps={{ withinPortal: false }}
            />
            <ActionIcon
              size="sm"
              color="green"
              variant="light"
              onClick={async () => {
                await handleAdd();
                setShowForm(false);
              }}
              disabled={!selectedOrg}
              loading={createOrgUser.isPending}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Group>
        )}

        {availableOrgs.length > 0 && !showForm && (
          <Button
            size="compact-sm"
            variant="subtle"
            leftSection={<IconPlus size={16} />}
            onClick={() => setShowForm(true)}
            fullWidth
          >
            Добавить
          </Button>
        )}
      </Stack>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            handleRemove(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        title="Удаление роли"
        message={`Убрать доступ «${deleteTarget?.orgName ?? ''}»?`}
      />
    </>
  );
}
