import { useState } from 'react';
import { Group, Select, Button, Text, Badge, ActionIcon } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useCreateOrganizationUser, useDeleteOrganizationUser } from '@/shared/hooks/useOrganizationUsers';
import { useOrg } from '@/shared/context/OrgContext';
import type { IOrganizationUser } from '@/shared/types';

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

interface InlineRoleCellProps {
  userId: string;
  assignments: IOrganizationUser[];
}

export function InlineRoleCell({ userId, assignments }: InlineRoleCellProps) {
  const createOrgUser = useCreateOrganizationUser();
  const deleteOrgUser = useDeleteOrganizationUser();
  const { organizations } = useOrg();
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<IOrganizationUser['role']>('user');

  const availableOrgs = organizations.filter(
    (o) => !assignments.some((a) => a.organization_id === o.id),
  );

  const handleAdd = async () => {
    if (!selectedOrg) return;
    await createOrgUser.mutateAsync({ userId, organizationId: selectedOrg, role: selectedRole });
    setSelectedOrg(null);
    setSelectedRole('user');
  };

  const handleRemove = async (id: string) => {
    await deleteOrgUser.mutateAsync(id);
  };

  return (
    <Group gap="xs">
      {assignments.length === 0 && !availableOrgs.length && (
        <Text size="sm" c="dimmed">Нет ролей</Text>
      )}
      {assignments.map((a) => {
        const orgName =
          organizations.find((o) => o.id === a.organization_id)?.name ?? a.organization_id;
        return (
          <Badge
            key={a.id}
            color={ROLE_COLORS[a.role]}
            size="sm"
            variant="light"
            rightSection={
              <ActionIcon
                size="xs"
                color={ROLE_COLORS[a.role]}
                variant="transparent"
                onClick={() => handleRemove(a.id)}
                loading={deleteOrgUser.isPending}
              >
                <IconTrash size={10} />
              </ActionIcon>
            }
          >
            {orgName}: {ROLE_LABELS[a.role]}
          </Badge>
        );
      })}
      {availableOrgs.length > 0 && (
        <>
          <Select
            data={availableOrgs.map((o) => ({ value: o.id, label: o.name }))}
            value={selectedOrg}
            onChange={setSelectedOrg}
            placeholder="Орг."
            size="xs"
            w={130}
          />
          <Select
            data={[
              { value: 'admin', label: 'Админ' },
              { value: 'moderator', label: 'Модератор' },
              { value: 'user', label: 'Пользователь' },
              { value: 'guest', label: 'Гость' },
            ]}
            value={selectedRole}
            onChange={(v) => v && setSelectedRole(v as IOrganizationUser['role'])}
            size="xs"
            w={130}
          />
          <Button
            size="xs"
            onClick={handleAdd}
            disabled={!selectedOrg}
            loading={createOrgUser.isPending}
          >
            +
          </Button>
        </>
      )}
    </Group>
  );
}
