import type { IUser } from '@/shared/types';
import type { UserDeleteConsequences } from '@/features/admin/model/user-delete-consequences';
import { CreateUserModal } from '@/features/admin/ui/user-modals/CreateUserModal';
import { EditUserModal } from '@/features/admin/ui/user-modals/EditUserModal';
import { AdminDeleteUserModal } from './AdminDeleteUserModal';
import type { AdminUserTarget } from './admin-page-types';

/** Пропсы модальных окон пользователей. */
export interface AdminUserModalsProps {
  createOpened: boolean;
  onCloseCreate: () => void;
  editUser: IUser | null;
  onCloseEdit: () => void;
  deleteTarget: AdminUserTarget | null;
  deleteConsequences: UserDeleteConsequences | null;
  deletePending: boolean;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}

/**
 * Модальные окна пользователей страницы администрирования.
 * Рендерит создание, редактирование и подтверждение удаления пользователя.
 */
export function AdminUserModals({
  createOpened,
  onCloseCreate,
  editUser,
  onCloseEdit,
  deleteTarget,
  deleteConsequences,
  deletePending,
  onCloseDelete,
  onConfirmDelete,
}: AdminUserModalsProps) {
  return (
    <>
      {/* Создание пользователя */}
      <CreateUserModal opened={createOpened} onClose={onCloseCreate} />

      {/* Редактирование пользователя */}
      <EditUserModal opened={editUser !== null} user={editUser} onClose={onCloseEdit} />

      {/* Подтверждение удаления пользователя */}
      <AdminDeleteUserModal
        target={deleteTarget}
        consequences={deleteConsequences}
        isPending={deletePending}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
