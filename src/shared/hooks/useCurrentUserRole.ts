import { useAuth } from '@/shared/context/AuthContext';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';

export function useCurrentUserRole(orgId: string) {
  const { user } = useAuth();
  const { data: orgUsers } = useOrganizationUsers();

  if (!user || !orgUsers) return null;

  const assignment = orgUsers.find(
    (ou) => ou.user_id === user.id && ou.organization_id === orgId,
  );
  return assignment?.role ?? null;
}

export function useIsAdmin(orgId: string) {
  const role = useCurrentUserRole(orgId);
  return role === 'admin';
}
