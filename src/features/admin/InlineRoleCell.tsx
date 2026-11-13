import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import {
  useCreateOrganizationUser,
  useDeleteOrganizationUser,
} from '@/shared/hooks/useOrganizationUsers';
import { getAccountingObjects } from '@/api/collections';
import { useOrg } from '@/shared/context/OrgContext';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { InlineRoleCellAssignmentRow } from './components/inline-role-cell/InlineRoleCellAssignmentRow';
import { ROLE_OPTIONS } from './components/inline-role-cell/InlineRoleCellRoleSelect';
import type { IOrganizationUser } from '@/shared/types';

type Role = IOrganizationUser['role'];

interface InlineRoleCellProps {
  userId: string;
  assignments: IOrganizationUser[];
  /** Reuses AdminPage's gate (admin and moderator); mail flags are never derived from role. */
  canManageMailPermissions: boolean;
}

export function InlineRoleCell({
  userId,
  assignments,
  canManageMailPermissions,
}: InlineRoleCellProps) {
  const createOrgUser = useCreateOrganizationUser();
  const deleteOrgUser = useDeleteOrganizationUser();
  const { organizations } = useOrg();
  const [showForm, setShowForm] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('guest');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; orgName: string } | null>(null);

  const availableOrgs = organizations.filter(
    (organization) => !assignments.some((a) => a.organization_id === organization.id),
  );

  const handleAdd = async () => {
    if (!selectedOrg) return;

    try {
      const objectIds =
        selectedRole === 'admin'
          ? undefined
          : (await getAccountingObjects(selectedOrg)).map((object) => object.id);

      await createOrgUser.mutateAsync({
        userId,
        organizationId: selectedOrg,
        role: selectedRole,
        objectIds,
      });
      setSelectedOrg(null);
      setSelectedRole('guest');
    } catch {
      /* тост об ошибке показывает onError в useCreateOrganizationUser */
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await deleteOrgUser.mutateAsync(id);
    } catch {
      /* тост об ошибке показывает onError в useDeleteOrganizationUser */
    }
  };

  return (
    <>
      {assignments.length === 0 && !availableOrgs.length ? (
        <Text size="sm" c="dimmed">
          Нет ролей
        </Text>
      ) : (
        <Stack gap={2}>
          {assignments.map((assignment) => {
            const orgName =
              organizations.find((organization) => organization.id === assignment.organization_id)
                ?.name ?? assignment.organization_id;

            return (
              <InlineRoleCellAssignmentRow
                key={assignment.id}
                assignment={assignment}
                orgName={orgName}
                canManageMailPermissions={canManageMailPermissions}
                onDelete={() => setDeleteTarget({ id: assignment.id, orgName })}
              />
            );
          })}
        </Stack>
      )}

      {showForm && (
        <Group gap={6} wrap="nowrap" mt="sm">
          <Select
            data={availableOrgs.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
            value={selectedOrg}
            onChange={setSelectedOrg}
            placeholder="Организация"
            aria-label="Новая организация"
            size="xs"
            style={{ flex: 1, minWidth: 0 }}
            comboboxProps={{ withinPortal: false }}
          />
          <Select
            data={ROLE_OPTIONS}
            value={selectedRole}
            onChange={(value) => value && setSelectedRole(value as Role)}
            aria-label="Новая роль"
            size="xs"
            w={170}
            comboboxProps={{ withinPortal: false }}
          />
          <ActionIcon
            size="sm"
            color="green"
            variant="light"
            aria-label="Добавить назначение"
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
          mt="sm"
        >
          Добавить
        </Button>
      )}

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
