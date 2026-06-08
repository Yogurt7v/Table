import { useState, useMemo } from 'react';
import {
  Container,
  Title,
  Group,
  Text,
  Stack,
} from '@mantine/core';
import { useOrg } from '@/shared/context/OrgContext';
import { useUsers, useDeleteUser } from '@/shared/hooks/useUsers';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import {
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
} from '@/shared/hooks/useOrganizations';
import { useAuth } from '@/shared/context/AuthContext';
import { CreateUserModal } from '@/features/admin/CreateUserModal';
import { CreateOrgModal } from '@/features/admin/CreateOrgModal';
import { EditOrgModal } from '@/features/admin/EditOrgModal';
import { DeleteOrgModal } from '@/features/admin/DeleteOrgModal';
import { OrganizationAdminTable } from '@/features/admin/OrganizationAdminTable';
import { UserAdminTable } from '@/features/admin/UserAdminTable';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { useQuery } from '@tanstack/react-query';
import {
  getBankAccounts,
  getAllBankAccounts,
  getAccountingObjects,
  getAllAccountingObjects,
  createBankAccount,
} from '@/api/collections';
import type { IBankAccount, IAccountingObject } from '@/shared/types';

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
  const { organizations, currentOrgId } = useOrg();
  const { data: users } = useUsers();
  const { data: orgUsers } = useOrganizationUsers();
  const deleteUser = useDeleteUser();
  const { user: currentUser } = useAuth();
  const currentRole = useCurrentUserRole(currentOrgId);

  const isRestricted = !!(
    currentOrgId && currentRole !== 'admin' && currentRole !== 'moderator'
  );
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();
  const [createOpened, setCreateOpened] = useState(false);
  const [showOrgForm, setShowOrgForm] = useState(false);
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

  const { data: allObjects = [] } = useQuery({
    queryKey: ['accounting_objects'],
    queryFn: getAllAccountingObjects,
  });

  const accountsByOrg = useMemo(() => {
    const map: Record<string, IBankAccount[]> = {};
    for (const acc of allAccounts) {
      (map[acc.organization_id] ??= []).push(acc);
    }
    return map;
  }, [allAccounts]);

  const objectsByOrg = useMemo(() => {
    const map: Record<string, IAccountingObject[]> = {};
    for (const obj of allObjects) {
      (map[obj.organization_id] ??= []).push(obj);
    }
    return map;
  }, [allObjects]);

  const { data: editAccounts } = useQuery({
    queryKey: ['bank_accounts', editOrgId],
    queryFn: () => getBankAccounts(editOrgId!),
    enabled: !!editOrgId,
  });

  const { data: editObjects = [] } = useQuery({
    queryKey: ['accounting_objects', editOrgId],
    queryFn: () => getAccountingObjects(editOrgId!),
    enabled: !!editOrgId,
  });

  const editOrgRole = orgUsers?.find(
    (ou) => ou.user_id === currentUser?.id && ou.organization_id === editOrgId,
  )?.role;
  const canEditAccountingObjects = editOrgRole === 'admin' || editOrgRole === 'moderator';

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

  if (isRestricted) {
    return (
      <Container py="xl">
        <Title order={3} ta="center" c="red">
          Доступ запрещён
        </Title>
        <Text ta="center" mt="sm">
          У вас нет прав для просмотра этой страницы.
        </Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>Администрирование</Title>
      </Group>

      <Stack gap="xl">
        {/* --- Организации --- */}
        <OrganizationAdminTable
          organizations={organizations}
          accountsByOrg={accountsByOrg}
          objectsByOrg={objectsByOrg}
          colorName={COLOR_NAME}
          onAdd={() => setShowOrgForm(true)}
          onEdit={openEditOrg}
          onDelete={(org) => setDeleteOrgTarget({ id: org.id, name: org.name })}
        />

        {/* --- Пользователи --- */}
        <UserAdminTable
          users={users}
          orgUsers={orgUsers}
          currentUserId={currentUser?.id}
          onAdd={() => setCreateOpened(true)}
          onDelete={(target) => setDeleteUserTarget(target)}
        />
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

      <DeleteOrgModal
        opened={!!deleteOrgTarget}
        orgName={deleteOrgTarget?.name ?? ''}
        isPending={deleteOrg.isPending}
        onClose={() => {
          setDeleteOrgTarget(null);
        }}
        onConfirm={() => {
          if (deleteOrgTarget) {
            deleteOrg.mutate(deleteOrgTarget.id);
          }
          setDeleteOrgTarget(null);
        }}
      />

      <CreateOrgModal
        opened={showOrgForm}
        onClose={() => {
          setShowOrgForm(false);
        }}
        onSave={async (data) => {
          const org = await createOrg.mutateAsync({ name: data.name, color: data.color });
          await Promise.all(data.accountNames.map((name) => createBankAccount(org.id, name)));
        }}
      />

      <EditOrgModal
        opened={!!editOrgId}
        orgName={editOrg?.name}
        editName={editName}
        editColor={editColor}
        editOrgId={editOrgId ?? ''}
        editAccounts={editAccounts}
        editObjects={editObjects}
        canEditAccountingObjects={canEditAccountingObjects}
        isPending={updateOrg.isPending}
        onClose={closeEditOrg}
        onNameChange={setEditName}
        onColorChange={setEditColor}
        onSave={handleSaveOrg}
      />
    </Container>
  );
}
