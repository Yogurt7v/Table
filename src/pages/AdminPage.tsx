import { useState } from 'react';
import { Anchor, Container, Group, Tabs, Text, Title } from '@mantine/core';
import { BreadcrumbsNav } from '@/shared/components/BreadcrumbsNav';
import { useOrg } from '@/shared/context/OrgContext';
import { useUsers, useDeleteUser } from '@/shared/hooks/useUsers';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import { useCurrentOrgUser } from '@/shared/hooks/useCurrentOrgUser';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useAuth } from '@/shared/context/AuthContext';
import { useMailPermissions } from '@/shared/hooks/useMailPermissions';
import { OrganizationAdminTable } from '@/features/admin/OrganizationAdminTable';
import { UserAdminTable } from '@/features/admin/UserAdminTable';
import { DeletedInvoicesSection } from '@/features/admin/DeletedInvoicesSection';
import { DeletedMailsSection } from '@/features/admin/DeletedMailsSection';
import { DeletedDocumentsSection } from '@/features/admin/DeletedDocumentsSection';
import type { OrgDeleteStats } from '@/features/admin/DeleteOrgModal';
import { AdminUserModals } from '@/features/admin/components/admin-page/AdminUserModals';
import { AdminOrgModals } from '@/features/admin/components/admin-page/AdminOrgModals';
import { useAdminPageData } from '@/features/admin/components/admin-page/useAdminPageData';
import { useAdminPageTabs } from '@/features/admin/components/admin-page/useAdminPageTabs';
import { useAdminPageOrgs } from '@/features/admin/components/admin-page/useAdminPageOrgs';
import type { AdminUserTarget } from '@/features/admin/components/admin-page/admin-page-types';
import type { IUser } from '@/shared/types';
import { ORG_COLOR_NAME } from '@/shared/utils/org-colors';

/**
 * Страница администрирования: организации, пользователи и архивы.
 * Здесь только композиция: данные даёт `useAdminPageData`, вкладки и параметры
 * адреса — `useAdminPageTabs`, действия с организациями — `useAdminPageOrgs`,
 * модальные окна — `AdminUserModals` и `AdminOrgModals`.
 *
 * Вкладку архива писем гейтит почтовый флаг, а не строка роли: у `deleted_*`
 * пустой `listRule`, и скрыть вкладку — единственная клиентская проверка.
 */
export function AdminPage() {
  const { organizations, currentOrgId } = useOrg();
  const { data: users } = useUsers();
  const { data: orgUsers } = useOrganizationUsers();
  const deleteUser = useDeleteUser();
  const { user: currentUser } = useAuth();
  const currentRole = useCurrentUserRole(currentOrgId);
  const mailPermissions = useMailPermissions(currentOrgId);
  const canViewMailArchive = mailPermissions.canViewArchive;

  const orgs = useAdminPageOrgs({ organizations });
  const tabs = useAdminPageTabs({ canViewMailArchive });

  const [createOpened, setCreateOpened] = useState(false);
  const [editUserTarget, setEditUserTarget] = useState<IUser | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUserTarget | null>(null);

  const data = useAdminPageData({
    editOrgId: orgs.editOrgId,
    deleteOrgTarget: orgs.deleteOrgTarget,
    deleteUserTarget,
    orgUsers,
    organizations,
  });

  const isRestricted = !!(currentOrgId && currentRole !== 'admin' && currentRole !== 'moderator');
  const canEditUsers = currentRole === 'admin' || currentRole === 'moderator';
  const canDeleteUsers = currentRole === 'admin';
  const canManageMailPermissions = currentRole === 'admin' || currentRole === 'moderator';
  const canDelete = currentRole === 'admin';
  const editOrgRole = useCurrentOrgUser(orgs.editOrgId)?.role;
  const canEditAccountingObjects = editOrgRole === 'admin' || editOrgRole === 'moderator';

  /** Счётчики удаляемой организации: счета, объекты, банковские счета и участники. */
  const deleteOrgTarget = orgs.deleteOrgTarget;
  const deleteOrgStats: OrgDeleteStats | undefined = deleteOrgTarget
    ? {
        invoicesCount: data.deleteOrgInvoicesCount ?? null,
        objectsCount: (data.objectsByOrg[deleteOrgTarget.id] ?? []).length,
        accountsCount: (data.accountsByOrg[deleteOrgTarget.id] ?? []).length,
        membersCount: (orgUsers ?? []).filter(
          (membership) => membership.organization_id === deleteOrgTarget.id,
        ).length,
      }
    : undefined;

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
    <Container
      size="xl"
      py="md"
      mih="calc(100dvh - var(--app-shell-header-height, 0px) - 2 * var(--app-shell-padding, 0px))"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Заголовок страницы: хлебные крошки и название */}
      <Group justify="space-between" mb="lg">
        <BreadcrumbsNav />
        <Title order={3}>Администрирование</Title>
      </Group>

      {/* Вкладки администрирования: организации, пользователи и архивы */}
      <Tabs value={tabs.activeTab} onChange={tabs.handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="organizations">Организации</Tabs.Tab>
          <Tabs.Tab value="users">Пользователи</Tabs.Tab>
          <Tabs.Tab value="archive">Архив счетов</Tabs.Tab>
          <Tabs.Tab value="documents-archive">Архив документов</Tabs.Tab>
          {canViewMailArchive && <Tabs.Tab value="mail-archive">Архив писем</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="organizations" pt="md">
          <OrganizationAdminTable
            organizations={organizations}
            accountsByOrg={data.accountsByOrg}
            objectsByOrg={data.objectsByOrg}
            colorName={ORG_COLOR_NAME}
            canDelete={canDelete}
            onAdd={() => orgs.setShowOrgForm(true)}
            onEdit={orgs.openEditOrg}
            onDelete={(org) => orgs.setDeleteOrgTarget({ id: org.id, name: org.name })}
          />
        </Tabs.Panel>

        <Tabs.Panel value="users" pt="md">
          <UserAdminTable
            users={users}
            orgUsers={orgUsers}
            currentUserId={currentUser?.id}
            accessibleOrgIds={organizations.map((org) => org.id)}
            canEdit={canEditUsers}
            canDelete={canDeleteUsers}
            canManageMailPermissions={canManageMailPermissions}
            onAdd={() => setCreateOpened(true)}
            onEdit={(user) => setEditUserTarget(user)}
            onDelete={(target) => setDeleteUserTarget(target)}
          />
        </Tabs.Panel>

        <Tabs.Panel value="archive" pt="md">
          {currentOrgId && (
            <DeletedInvoicesSection
              orgId={currentOrgId}
              highlightInvoiceId={tabs.highlightDeletedId}
              onHighlightConsumed={tabs.clearHighlightParam}
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="documents-archive" pt="md">
          {currentOrgId && <DeletedDocumentsSection orgId={currentOrgId} />}
        </Tabs.Panel>

        {canViewMailArchive && (
          <Tabs.Panel value="mail-archive" pt="md">
            {currentOrgId && <DeletedMailsSection orgId={currentOrgId} />}
          </Tabs.Panel>
        )}
      </Tabs>

      {/* Подвал страницы */}
      <Text size="sm" c="dimmed" ta="center" mt="auto" pt="xl">
        © {new Date().getFullYear()} Реестры счетов ·{' '}
        <Anchor href="https://github.com/Yogurt7v/Table" target="_blank" rel="noreferrer">
          Исходный код
        </Anchor>
      </Text>

      {/* Модальные окна пользователей: создание, редактирование, удаление */}
      <AdminUserModals
        createOpened={createOpened}
        onCloseCreate={() => setCreateOpened(false)}
        editUser={editUserTarget}
        onCloseEdit={() => setEditUserTarget(null)}
        deleteTarget={deleteUserTarget}
        deleteConsequences={data.deleteUserConsequences}
        deletePending={deleteUser.isPending}
        onCloseDelete={() => setDeleteUserTarget(null)}
        onConfirmDelete={() => {
          if (deleteUserTarget) {
            deleteUser.mutate(deleteUserTarget.id);
          }
          setDeleteUserTarget(null);
        }}
      />

      {/* Модальные окна организаций: создание, редактирование, удаление */}
      <AdminOrgModals
        create={{
          opened: orgs.showOrgForm,
          onClose: () => orgs.setShowOrgForm(false),
          onSave: orgs.handleCreateOrg,
        }}
        edit={{
          org: orgs.editOrg,
          orgId: orgs.editOrgId,
          name: orgs.editName,
          color: orgs.editColor,
          accounts: data.editAccounts,
          objects: data.editObjects,
          canEditObjects: canEditAccountingObjects,
          pending: orgs.updatePending,
          onClose: orgs.closeEditOrg,
          onNameChange: orgs.setEditName,
          onColorChange: orgs.setEditColor,
          onSave: orgs.handleSaveOrg,
        }}
        remove={{
          target: orgs.deleteOrgTarget,
          pending: orgs.deletePending,
          stats: deleteOrgStats,
          onClose: () => orgs.setDeleteOrgTarget(null),
          onConfirm: orgs.confirmDeleteOrg,
        }}
      />
    </Container>
  );
}
