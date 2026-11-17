import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
} from '@/shared/hooks/useOrganizations';
import { createBankAccount } from '@/api/collections';
import type { IOrganization } from '@/shared/types';
import type { AdminCreateOrgData, AdminOrgTarget } from './admin-page-types';

/** Параметры действий с организациями. */
export interface UseAdminPageOrgsParams {
  organizations: IOrganization[];
}

/**
 * Действия со организациями на странице администрирования.
 * Хранит состояние форм создания/редактирования/удаления, применяет мутации
 * и создаёт расчётные счета новой организации.
 */
export function useAdminPageOrgs({ organizations }: UseAdminPageOrgsParams) {
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();

  const [showOrgForm, setShowOrgForm] = useState(false);
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<AdminOrgTarget | null>(null);
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>('');

  const editOrg = organizations.find((org) => org.id === editOrgId);

  /** Открывает редактирование организации, подставляя её имя и цвет. */
  const openEditOrg = (orgId: string) => {
    const org = organizations.find((item) => item.id === orgId);
    if (org) {
      setEditName(org.name);
      setEditColor(org.color);
    }
    setEditOrgId(orgId);
  };

  const closeEditOrg = () => {
    setEditOrgId(null);
  };

  /** Сохраняет переименование и цвет организации. */
  const handleSaveOrg = async () => {
    if (!editOrgId || !editName.trim()) return;
    try {
      await updateOrg.mutateAsync({
        id: editOrgId,
        name: editName.trim(),
        color: editColor,
      });
      closeEditOrg();
    } catch {
      /* тост об ошибке показывает onError в useUpdateOrganization */
    }
  };

  /** Создаёт организацию и её расчётные счета, предупреждая о частичном сбое. */
  const handleCreateOrg = async (data: AdminCreateOrgData) => {
    const org = await createOrg.mutateAsync({ name: data.name, color: data.color });
    const results = await Promise.allSettled(
      data.accountNames.map((name) => createBankAccount(org.id, name)),
    );
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) {
      notifications.show({
        color: 'yellow',
        title: 'Организация создана',
        message: `Счета добавлены частично (${data.accountNames.length - failed} из ${data.accountNames.length}). Остальные добавьте через редактирование организации.`,
        autoClose: 10000,
      });
    }
  };

  /** Удаляет организацию после подтверждения. */
  const confirmDeleteOrg = () => {
    if (deleteOrgTarget) {
      deleteOrg.mutate(deleteOrgTarget.id);
    }
    setDeleteOrgTarget(null);
  };

  return {
    showOrgForm,
    setShowOrgForm,
    deleteOrgTarget,
    setDeleteOrgTarget,
    editOrgId,
    editName,
    setEditName,
    editColor,
    setEditColor,
    editOrg,
    openEditOrg,
    closeEditOrg,
    handleSaveOrg,
    handleCreateOrg,
    confirmDeleteOrg,
    updatePending: updateOrg.isPending,
    deletePending: deleteOrg.isPending,
  };
}
