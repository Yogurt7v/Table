import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getBankAccounts,
  getAllBankAccounts,
  getAccountingObjects,
  getAllAccountingObjects,
  countInvoicesByOrg,
} from '@/api/collections';
import {
  buildUserDeleteConsequences,
  type UserDeleteConsequences,
} from '@/features/admin/model/user-delete-consequences';
import type {
  IAccountingObject,
  IBankAccount,
  IOrganization,
  IOrganizationUser,
} from '@/shared/types';
import type { AdminOrgTarget, AdminUserTarget } from './admin-page-types';

/** Параметры выборок страницы администрирования. */
export interface UseAdminPageDataParams {
  editOrgId: string | null;
  deleteOrgTarget: AdminOrgTarget | null;
  deleteUserTarget: AdminUserTarget | null;
  orgUsers: IOrganizationUser[] | undefined;
  organizations: IOrganization[];
}

/**
 * Выборки страницы администрирования.
 * Собирает банковские счета, объекты учёта и счётчики удаления, а также
 * производные структуры: счета и объекты по организациям и последствия
 * удаления пользователя.
 */
export function useAdminPageData({
  editOrgId,
  deleteOrgTarget,
  deleteUserTarget,
  orgUsers,
  organizations,
}: UseAdminPageDataParams) {
  const { data: allAccounts = [] } = useQuery({
    queryKey: ['bank_accounts'],
    queryFn: getAllBankAccounts,
  });

  const { data: allObjects = [] } = useQuery({
    queryKey: ['accounting_objects'],
    queryFn: getAllAccountingObjects,
  });

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

  const { data: deleteOrgInvoicesCount } = useQuery({
    queryKey: ['invoices_count', deleteOrgTarget?.id],
    queryFn: () => countInvoicesByOrg(deleteOrgTarget!.id),
    enabled: !!deleteOrgTarget,
  });

  /** Банковские счета, сгруппированные по организациям. */
  const accountsByOrg = useMemo(() => {
    const map: Record<string, IBankAccount[]> = {};
    for (const acc of allAccounts) {
      (map[acc.organization_id] ??= []).push(acc);
    }
    return map;
  }, [allAccounts]);

  /** Объекты учёта, сгруппированные по организациям. */
  const objectsByOrg = useMemo(() => {
    const map: Record<string, IAccountingObject[]> = {};
    for (const obj of allObjects) {
      (map[obj.organization_id] ??= []).push(obj);
    }
    return map;
  }, [allObjects]);

  /** Что произойдёт с членствами пользователя, если его удалить. */
  const deleteUserConsequences = useMemo<UserDeleteConsequences | null>(() => {
    if (!deleteUserTarget) return null;
    return buildUserDeleteConsequences(deleteUserTarget.id, orgUsers ?? [], organizations);
  }, [deleteUserTarget, orgUsers, organizations]);

  return {
    allAccounts,
    allObjects,
    accountsByOrg,
    objectsByOrg,
    editAccounts,
    editObjects,
    deleteOrgInvoicesCount,
    deleteUserConsequences,
  };
}
