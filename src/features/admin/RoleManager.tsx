import { useState } from 'react';
import {
  Group,
  Select,
  Button,
  Text,
  Badge,
  ActionIcon,
  Stack,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useOrganizationUsers, useCreateOrganizationUser, useDeleteOrganizationUser } from '@/shared/hooks/useOrganizationUsers';
import { useOrg } from '@/shared/context/OrgContext';
import type { IOrganizationUser } from '@/shared/types';

interface RoleManagerProps {
  userId: string;
  userName: string;
}

const ROLE_COLORS: Record<IOrganizationUser['role'], string> = {
  admin: 'red',
  moderator: 'blue',
  user: 'green',
  guest: 'gray',
};

const ROLE_LABELS: Record<IOrganizationUser['role'], string> = {
  admin: 'Администратор',
  moderator: 'Модератор',
  user: 'Пользователь',
  guest: 'Гость',
};

export function RoleManager({ userId, userName }: RoleManagerProps) {
  const { data: orgUsers } = useOrganizationUsers();
  const createOrgUser = useCreateOrganizationUser();
  const deleteOrgUser = useDeleteOrganizationUser();
  const { organizations } = useOrg();
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<IOrganizationUser['role']>('user');

  const userAssignments = (orgUsers ?? []).filter((ou) => ou.user_id === userId);

  const handleAdd = async () => {
    if (!selectedOrg) return;
    await createOrgUser.mutateAsync({ userId, organizationId: selectedOrg, role: selectedRole });
    setSelectedOrg(null);
    setSelectedRole('user');
  };

  const handleRemove = async (id: string) => {
    await deleteOrgUser.mutateAsync(id);
  };

  const availableOrgs = organizations.filter(
    (o) => !userAssignments.some((a) => a.organization_id === o.id),
  );

  return (
    <Stack gap="xs">
      {userAssignments.length === 0 && (
        <Text size="sm" c="dimmed">Нет назначений</Text>
      )}
      {userAssignments.map((assignment) => {
        const orgName =
          assignment.expand?.organization_id?.name ??
          organizations.find((o) => o.id === assignment.organization_id)?.name ??
          assignment.organization_id;
        return (
          <Group key={assignment.id} gap="xs">
            <Text size="sm">{orgName}</Text>
            <Badge color={ROLE_COLORS[assignment.role]} size="sm">
              {ROLE_LABELS[assignment.role]}
            </Badge>
            <ActionIcon
              size="xs"
              color="red"
              variant="subtle"
              onClick={() => handleRemove(assignment.id)}
              loading={deleteOrgUser.isPending}
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
        );
      })}
      {availableOrgs.length > 0 && (
        <Group gap="xs">
          <Select
            data={availableOrgs.map((o) => ({ value: o.id, label: o.name }))}
            value={selectedOrg}
            onChange={setSelectedOrg}
            placeholder="Организация"
            size="xs"
            w={200}
          />
          <Select
            data={[
              { value: 'admin', label: 'Администратор' },
              { value: 'moderator', label: 'Модератор' },
              { value: 'user', label: 'Пользователь' },
              { value: 'guest', label: 'Гость' },
            ]}
            value={selectedRole}
            onChange={(v) => v && setSelectedRole(v as IOrganizationUser['role'])}
            size="xs"
            w={150}
          />
          <Button
            size="xs"
            onClick={handleAdd}
            disabled={!selectedOrg}
            loading={createOrgUser.isPending}
          >
            Добавить
          </Button>
        </Group>
      )}
    </Stack>
  );
}
