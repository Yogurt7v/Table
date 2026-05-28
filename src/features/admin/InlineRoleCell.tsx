import { useState } from 'react';
import {
  Group,
  Stack,
  Select,
  Button,
  Text,
  Badge,
  ActionIcon,
  Popover,
  Checkbox,
  CheckboxGroup,
  Loader,
  Table,
} from '@mantine/core';
import { IconTrash, IconPlus, IconEye } from '@tabler/icons-react';
import {
  useCreateOrganizationUser,
  useDeleteOrganizationUser,
  useUpdateOrganizationUser,
} from '@/shared/hooks/useOrganizationUsers';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { useOrg } from '@/shared/context/OrgContext';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { IOrganizationUser } from '@/shared/types';

const ROLE_COLORS: Record<IOrganizationUser['role'], string> = {
  admin: 'red',
  moderator: 'blue',
  user: 'green',
  boss: 'yellow',
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

function ObjectCheckboxList({
  orgId,
  selected,
  onChange,
}: {
  orgId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: objects, isLoading } = useAccountingObjects(orgId);

  if (isLoading) return <Loader size="xs" />;

  if (!objects || objects.length === 0) {
    return (
      <Text size="xs" c="dimmed" fs="italic">
        У организации нет объектов
      </Text>
    );
  }

  return (
    <CheckboxGroup value={selected} onChange={onChange}>
      <Stack gap={4}>
        {objects?.map((obj) => (
          <Checkbox key={obj.id} value={obj.id} label={obj.name} size="xs" />
        ))}
      </Stack>
    </CheckboxGroup>
  );
}

function ObjectLabels({ orgId, objectIds }: { orgId: string; objectIds: string[] }) {
  const { data: objects } = useAccountingObjects(orgId);
  if (!objects) return null;

  const names = objectIds
    .map((id) => objects.find((o) => o.id === id)?.name)
    .filter((n): n is string => !!n);

  if (names.length === 0) return null;

  return (
    <Group gap={2} wrap="nowrap">
      {names.map((name) => (
        <Badge key={name} color="gray" size="xs" variant="light">
          {name}
        </Badge>
      ))}
    </Group>
  );
}

export function InlineRoleCell({ userId, assignments }: InlineRoleCellProps) {
  const createOrgUser = useCreateOrganizationUser();
  const deleteOrgUser = useDeleteOrganizationUser();
  const updateOrgUser = useUpdateOrganizationUser();
  const { organizations } = useOrg();
  const [showForm, setShowForm] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<IOrganizationUser['role']>('guest');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; orgName: string } | null>(null);
  const [objectsPopoverId, setObjectsPopoverId] = useState<string | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);

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
      {assignments.length === 0 && !availableOrgs.length ? (
        <Text size="sm" c="dimmed">
          Нет ролей
        </Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Организация</Table.Th>
              <Table.Th w={120}>Роль</Table.Th>
              <Table.Th>Объекты</Table.Th>
              <Table.Th w={50} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {assignments.map((a) => {
              const orgName =
                organizations.find((o) => o.id === a.organization_id)?.name ?? a.organization_id;
              return (
                <Table.Tr key={a.id}>
                  <Table.Td>
                    <Text size="sm">{orgName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={ROLE_COLORS[a.role]} size="sm" variant="light">
                      {ROLE_LABELS[a.role]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      {a.objects && a.objects.length > 0 && a.role !== 'admin' && (
                        <ObjectLabels orgId={a.organization_id} objectIds={a.objects} />
                      )}
                      {a.role !== 'admin' && (
                        <Popover
                          opened={objectsPopoverId === a.id}
                          onClose={() => setObjectsPopoverId(null)}
                          closeOnClickOutside={false}
                        >
                          <Popover.Target>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color={a.objects && a.objects.length > 0 ? 'blue' : 'gray'}
                              onClick={() => {
                                setObjectsPopoverId(objectsPopoverId === a.id ? null : a.id);
                                setSelectedObjects(a.objects ?? []);
                              }}
                            >
                              <IconEye size={24} />
                            </ActionIcon>
                          </Popover.Target>
                          <Popover.Dropdown>
                            <ObjectCheckboxList
                              orgId={a.organization_id}
                              selected={selectedObjects}
                              onChange={setSelectedObjects}
                            />
                            <Group justify="flex-end" mt="xs">
                              <Button
                                size="compact-xs"
                                variant="light"
                                onClick={() => setObjectsPopoverId(null)}
                              >
                                Отмена
                              </Button>
                              <Button
                                size="compact-xs"
                                onClick={async () => {
                                  await updateOrgUser.mutateAsync({
                                    id: a.id,
                                    data: { objects: selectedObjects },
                                  });
                                  setObjectsPopoverId(null);
                                }}
                                loading={updateOrgUser.isPending}
                              >
                                Сохранить
                              </Button>
                            </Group>
                          </Popover.Dropdown>
                        </Popover>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      size="md"
                      color="red"
                      variant="subtle"
                      onClick={() => setDeleteTarget({ id: a.id, orgName })}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      {showForm && (
        <Group gap={6} wrap="nowrap" mt="sm">
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
