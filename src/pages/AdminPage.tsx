import { useState } from 'react';
import {
  Container,
  Title,
  Table,
  Button,
  Group,
  Text,
  ActionIcon,
  Stack,
  TextInput,
  Select,
} from '@mantine/core';
import { IconTrash, IconUserPlus, IconBuilding, IconPlus, IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import { useOrg } from '@/shared/context/OrgContext';
import { useUsers, useDeleteUser } from '@/shared/hooks/useUsers';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import { useCreateOrganization, useUpdateOrganization, useDeleteOrganization } from '@/shared/hooks/useOrganizations';
import { useAuth } from '@/shared/context/AuthContext';
import { CreateUserModal } from '@/features/admin/CreateUserModal';
import { InlineRoleCell } from '@/features/admin/InlineRoleCell';
import { ConfirmModal } from '@/shared/components/ConfirmModal';

const COLORS = [
  { value: '#228be6', label: 'Синий' },
  { value: '#40c057', label: 'Зелёный' },
  { value: '#fa5252', label: 'Красный' },
  { value: '#fab005', label: 'Жёлтый' },
  { value: '#7950f2', label: 'Фиолетовый' },
  { value: '#fd7e14', label: 'Оранжевый' },
  { value: '#15aabf', label: 'Голубой' },
  { value: '#e64980', label: 'Розовый' },
];

export function AdminPage() {
  const { organizations } = useOrg();
  const { data: users } = useUsers();
  const { data: orgUsers } = useOrganizationUsers();
  const deleteUser = useDeleteUser();
  const { user: currentUser } = useAuth();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();
  const [createOpened, setCreateOpened] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgColor, setOrgColor] = useState<string>(COLORS[0].value);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) return;
    await createOrg.mutateAsync({ name: orgName.trim(), color: orgColor });
    setOrgName('');
    setOrgColor(COLORS[0].value);
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>Администрирование</Title>
      </Group>

      <Stack gap="xl">
        {/* --- Организации --- */}
        <div>
          <Group mb="sm">
            <IconBuilding size={20} />
            <Title order={4}>Организации</Title>
          </Group>

          <Table striped highlightOnHover withTableBorder mb="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Название</Table.Th>
                <Table.Th>Цвет</Table.Th>
                <Table.Th w={60} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {organizations.map((org) => {
                const isEditing = editingOrgId === org.id;
                return (
                  <Table.Tr key={org.id}>
                    <Table.Td>
                      {isEditing ? (
                        <TextInput
                          size="xs"
                          value={editName}
                          onChange={(e) => setEditName(e.currentTarget.value)}
                        />
                      ) : (
                        org.name
                      )}
                    </Table.Td>
                    <Table.Td>
                      {isEditing ? (
                        <Select
                          size="xs"
                          data={COLORS}
                          value={editColor}
                          onChange={(v) => v && setEditColor(v)}
                          w={130}
                        />
                      ) : (
                        <Group gap="xs">
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              backgroundColor: org.color,
                            }}
                          />
                          <Text size="sm">{org.color}</Text>
                        </Group>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {isEditing ? (
                          <>
                            <ActionIcon
                              color="green"
                              variant="subtle"
                              onClick={async () => {
                                await updateOrg.mutateAsync({
                                  id: org.id,
                                  name: editName.trim() || org.name,
                                  color: editColor,
                                });
                                setEditingOrgId(null);
                              }}
                              loading={updateOrg.isPending}
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                            <ActionIcon
                              color="gray"
                              variant="subtle"
                              onClick={() => setEditingOrgId(null)}
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          </>
                        ) : (
                          <>
                            <ActionIcon
                              color="blue"
                              variant="subtle"
                              onClick={() => {
                                setEditingOrgId(org.id);
                                setEditName(org.name);
                                setEditColor(org.color);
                              }}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() => setDeleteOrgTarget({ id: org.id, name: org.name })}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>

          <Group gap="xs">
            <TextInput
              placeholder="Название организации"
              value={orgName}
              onChange={(e) => setOrgName(e.currentTarget.value)}
              size="xs"
              w={250}
            />
            <Select
              data={COLORS}
              value={orgColor}
              onChange={(v) => v && setOrgColor(v)}
              size="xs"
              w={130}
            />
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={handleCreateOrg}
              loading={createOrg.isPending}
              disabled={!orgName.trim()}
            >
              Добавить
            </Button>
          </Group>
        </div>

        {/* --- Пользователи --- */}
        <div>
          <Group justify="space-between" mb="sm">
            <Group>
              <IconUserPlus size={20} />
              <Title order={4}>Пользователи</Title>
            </Group>
            <Button
              leftSection={<IconUserPlus size={16} />}
              onClick={() => setCreateOpened(true)}
            >
              Добавить пользователя
            </Button>
          </Group>

          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Имя</Table.Th>
                <Table.Th>Логин</Table.Th>
                <Table.Th>Роли в организациях</Table.Th>
                <Table.Th>Дата регистрации</Table.Th>
                <Table.Th w={60} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users?.map((user) => {
                const userOrgUsers = (orgUsers ?? []).filter(
                  (ou) => ou.user_id === user.id,
                );

                return (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Text>{user.name || '—'}</Text>
                    </Table.Td>
                    <Table.Td>{user.login}</Table.Td>
                    <Table.Td>
                      <InlineRoleCell userId={user.id} assignments={userOrgUsers} />
                    </Table.Td>
                    <Table.Td>
                      {new Date(user.created).toLocaleString('ru-RU')}
                    </Table.Td>
                    <Table.Td>
                      {currentUser?.id !== user.id && (
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => setDeleteUserTarget({ id: user.id, name: user.name || user.login })}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
      </Stack>

      <CreateUserModal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
      />

      <ConfirmModal
        opened={!!deleteUserTarget}
        onClose={() => setDeleteUserTarget(null)}
        onConfirm={() => {
          if (deleteUserTarget) {
            deleteUser.mutate(deleteUserTarget.id);
          }
          setDeleteUserTarget(null);
        }}
        title="Удаление пользователя"
        message={`Вы уверены, что хотите удалить пользователя «${deleteUserTarget?.name ?? ''}»?`}
        loading={deleteUser.isPending}
      />

      <ConfirmModal
        opened={!!deleteOrgTarget}
        onClose={() => setDeleteOrgTarget(null)}
        onConfirm={() => {
          if (deleteOrgTarget) {
            deleteOrg.mutate(deleteOrgTarget.id);
          }
          setDeleteOrgTarget(null);
        }}
        title="Удаление организации"
        message={`Вы уверены, что хотите удалить организацию «${deleteOrgTarget?.name ?? ''}»?`}
        loading={deleteOrg.isPending}
      />
    </Container>
  );
}
