import type { IAccountingObject, IBankAccount, IOrganization } from '@/shared/types';
import type { OrgDeleteStats } from '@/features/admin/ui/org-modals/DeleteOrgModal';
import { CreateOrgModal } from '@/features/admin/ui/org-modals/CreateOrgModal';
import { EditOrgModal } from '@/features/admin/ui/org-modals/EditOrgModal';
import { DeleteOrgModal } from '@/features/admin/ui/org-modals/DeleteOrgModal';
import type { AdminCreateOrgData, AdminOrgTarget } from './admin-page-types';

/** Пропсы создания организации. */
export interface AdminOrgCreateProps {
  opened: boolean;
  onClose: () => void;
  onSave: (data: AdminCreateOrgData) => Promise<void>;
}

/** Пропсы редактирования организации. */
export interface AdminOrgEditProps {
  org: IOrganization | undefined;
  orgId: string | null;
  name: string;
  color: string;
  accounts: IBankAccount[] | undefined;
  objects: IAccountingObject[];
  canEditObjects: boolean;
  pending: boolean;
  onClose: () => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onSave: () => void;
}

/** Пропсы удаления организации. */
export interface AdminOrgRemoveProps {
  target: AdminOrgTarget | null;
  pending: boolean;
  stats: OrgDeleteStats | undefined;
  onClose: () => void;
  onConfirm: () => void;
}

/** Пропсы модальных окон организаций. */
export interface AdminOrgModalsProps {
  create: AdminOrgCreateProps;
  edit: AdminOrgEditProps;
  remove: AdminOrgRemoveProps;
}

/**
 * Модальные окна организаций страницы администрирования.
 * Рендерит удаление, создание и редактирование организации — по группе пропсов
 * на каждое окно.
 */
export function AdminOrgModals({ create, edit, remove }: AdminOrgModalsProps) {
  return (
    <>
      {/* Удаление организации со счётчиками связанных данных */}
      <DeleteOrgModal
        opened={remove.target !== null}
        orgName={remove.target?.name ?? ''}
        isPending={remove.pending}
        stats={remove.stats}
        onClose={remove.onClose}
        onConfirm={remove.onConfirm}
      />

      {/* Создание организации и её расчётных счетов */}
      <CreateOrgModal opened={create.opened} onClose={create.onClose} onSave={create.onSave} />

      {/* Редактирование организации: имя, цвет, счета и объекты учёта */}
      <EditOrgModal
        opened={edit.orgId !== null}
        orgName={edit.org?.name}
        editName={edit.name}
        editColor={edit.color}
        editOrgId={edit.orgId ?? ''}
        editAccounts={edit.accounts}
        editObjects={edit.objects}
        canEditAccountingObjects={edit.canEditObjects}
        isPending={edit.pending}
        onClose={edit.onClose}
        onNameChange={edit.onNameChange}
        onColorChange={edit.onColorChange}
        onSave={edit.onSave}
      />
    </>
  );
}
