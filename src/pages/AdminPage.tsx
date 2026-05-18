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
  Modal,
} from '@mantine/core';
import { IconTrash, IconUserPlus, IconBuilding, IconPlus, IconPencil } from '@tabler/icons-react';
import { useOrg } from '@/shared/context/OrgContext';
import { useUsers, useDeleteUser } from '@/shared/hooks/useUsers';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import {
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
} from '@/shared/hooks/useOrganizations';
import { useAuth } from '@/shared/context/AuthContext';
import { CreateUserModal } from '@/features/admin/CreateUserModal';
import { InlineRoleCell } from '@/features/admin/InlineRoleCell';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { BankAccountManager } from '@/features/admin/BankAccountManager';
import { useQuery } from '@tanstack/react-query';
import { getBankAccounts, getAllBankAccounts } from '@/api/collections';
import { createBankAccount } from '@/api/collections';
import type { IBankAccount } from '@/shared/types';

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

const COLOR_NAME: Record<string, string> = Object.fromEntries(
  COLORS.map((c) => [c.value, c.label]),
);

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
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgColor, setOrgColor] = useState<string>(COLORS[0]!.value);
  const [accountNames, setAccountNames] = useState<string[]>([]);
  const [newAccountName, setNewAccountName] = useState('');
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<{ id: string; name: string } | null>(null);
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>('');

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['bank_accounts'],
    queryFn: getAllBankAccounts,
  });

  const accountsByOrg: Record<string, IBankAccount[]> = {};
  for (const acc of allAccounts) {
    (accountsByOrg[acc.organization_id] ??= []).push(acc);
  }

  const { data: editAccounts } = useQuery({
    queryKey: ['bank_accounts', editOrgId],
    queryFn: () => getBankAccounts(editOrgId!),
    enabled: !!editOrgId,
  });

  const editOrg = organizations.find((o) => o.id === editOrgId);

  const openEditOrg = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setEditName(org.name);
      setEditColor(org.color);
    }
    setEditOrgId(orgId);
  };

  const closeEditOrg = () => {
    setEditOrgId(null);
  };

  const handleSaveOrg = async () => {
    if (!editOrgId || !editName.trim()) return;
    await updateOrg.mutateAsync({
      id: editOrgId,
      name: editName.trim(),
      color: editColor,
    });
    closeEditOrg();
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim()) return;
    const org = await createOrg.mutateAsync({ name: orgName.trim(), color: orgColor });
    await Promise.all(accountNames.map((name) => createBankAccount(org.id, name)));
    setOrgName('');
    setOrgColor(COLORS[0]!.value);
    setAccountNames([]);
    setNewAccountName('');
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>Администрирование</Title>
      </Group>

      <Stack gap="xl">
        {/* --- Организации --- */}
        <div>
          <Group justify="space-between" mb="sm">
            <Group>
              <IconBuilding size={20} />
              <Title order={4}>Организации</Title>
            </Group>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setShowOrgForm(true)}>
              Добавить организацию
            </Button>
          </Group>

          <Table striped highlightOnHover withTableBorder mb="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Название</Table.Th>
                <Table.Th>Счета</Table.Th>
                <Table.Th>Цвет</Table.Th>
                <Table.Th w={100} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {organizations.map((org) => (
                <Table.Tr key={org.id}>
                  <Table.Td>
                    <Text size="mt">{org.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      {(accountsByOrg[org.id] ?? []).length === 0 ? (
                        <Text size="xs" c="dimmed">
                          Нет счетов
                        </Text>
                      ) : (
                        (accountsByOrg[org.id] ?? []).map((acc) => (
                          <Text key={acc.id} size="sm">
                            {acc.account_number}
                          </Text>
                        ))
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          backgroundColor: org.color,
                        }}
                      />
                      <Text size="sm">{COLOR_NAME[org.color] || org.color}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        color="blue"
                        variant="subtle"
                        size="lg"
                        onClick={() => openEditOrg(org.id)}
                      >
                        <IconPencil size={22} />
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        size="lg"
                        onClick={() => setDeleteOrgTarget({ id: org.id, name: org.name })}
                      >
                        <IconTrash size={22} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>

        {/* --- Пользователи --- */}
        <div>
          <Group justify="space-between" mb="sm">
            <Group>
              <IconUserPlus size={20} />
              <Title order={4}>Пользователи</Title>
            </Group>
            <Button leftSection={<IconUserPlus size={16} />} onClick={() => setCreateOpened(true)}>
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
                const userOrgUsers = (orgUsers ?? []).filter((ou) => ou.user_id === user.id);

                return (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Text>{user.name || '—'}</Text>
                    </Table.Td>
                    <Table.Td>{user.login}</Table.Td>
                    <Table.Td>
                      <InlineRoleCell userId={user.id} assignments={userOrgUsers} />
                    </Table.Td>
                    <Table.Td>{new Date(user.created).toLocaleString('ru-RU')}</Table.Td>
                    <Table.Td>
                      {currentUser?.id !== user.id && (
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() =>
                            setDeleteUserTarget({ id: user.id, name: user.name || user.login })
                          }
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

      <CreateUserModal opened={createOpened} onClose={() => setCreateOpened(false)} />

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

      {/* Create Org Modal */}
      <Modal
        opened={showOrgForm}
        onClose={() => {
          setShowOrgForm(false);
          setAccountNames([]);
          setNewAccountName('');
        }}
        title="Добавить организацию"
        size="md"
      >
        <Stack>
          <TextInput
            label="Название"
            value={orgName}
            onChange={(e) => setOrgName(e.currentTarget.value)}
            required
          />
          <Select
            label="Цвет"
            data={COLORS}
            value={orgColor}
            onChange={(v) => v && setOrgColor(v)}
          />

          <Text size="sm" fw={500} mt="sm">
            Расчётные счета
          </Text>

          {accountNames.map((name, i) => (
            <Group key={i} gap={6} wrap="nowrap">
              <Text size="sm" style={{ flex: 1 }}>
                {name}
              </Text>
              <ActionIcon
                size="sm"
                color="red"
                variant="subtle"
                onClick={() => setAccountNames(accountNames.filter((_, j) => j !== i))}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}

          <Group gap={6} wrap="nowrap">
            <TextInput
              size="xs"
              placeholder="Название счёта"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button
              size="compact-xs"
              onClick={() => {
                if (newAccountName.trim()) {
                  setAccountNames([...accountNames, newAccountName.trim()]);
                  setNewAccountName('');
                }
              }}
              disabled={!newAccountName.trim()}
            >
              Добавить
            </Button>
          </Group>

          <Button
            fullWidth
            mt="sm"
            onClick={async () => {
              await handleCreateOrg();
              setShowOrgForm(false);
            }}
            loading={createOrg.isPending}
            disabled={!orgName.trim()}
          >
            Создать
          </Button>
        </Stack>
      </Modal>

      {/* Edit Org Modal */}
      <Modal
        opened={!!editOrgId}
        onClose={closeEditOrg}
        title={`Редактирование: ${editOrg?.name ?? ''}`}
        size="md"
      >
        {editOrgId && editAccounts && (
          <Stack>
            <TextInput
              label="Название"
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
            />
            <Select
              label="Цвет"
              data={COLORS}
              value={editColor}
              onChange={(v) => v && setEditColor(v)}
            />
            <BankAccountManager organizationId={editOrgId} accounts={editAccounts} />
            <Button
              fullWidth
              onClick={handleSaveOrg}
              loading={updateOrg.isPending}
              disabled={!editName.trim()}
            >
              Сохранить
            </Button>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
