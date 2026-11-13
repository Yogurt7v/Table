import { useAuth } from '@/shared/context/AuthContext';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import type { IOrganizationUser } from '@/shared/types';

/**
 * Возвращает членство подписанного пользователя в одной организации.
 * Решает membership по `user_id` + `organization_id` из кэша `organization_users`.
 * Возвращает `undefined`, пока данные не загрузились или пользователь не состоит в организации.
 */
export function useCurrentOrgUser(orgId: string | null): IOrganizationUser | undefined {
  const { user } = useAuth();
  const { data: orgUsers } = useOrganizationUsers();

  if (!orgId || !user || !orgUsers) return undefined;

  return orgUsers.find((ou) => ou.user_id === user.id && ou.organization_id === orgId);
}
