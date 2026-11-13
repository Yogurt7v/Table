import { useCurrentOrgUser } from '@/shared/hooks/useCurrentOrgUser';

export function useCurrentUserRole(orgId: string) {
  const assignment = useCurrentOrgUser(orgId);
  return assignment?.role ?? null;
}

export function useIsAdmin(orgId: string) {
  const role = useCurrentUserRole(orgId);
  return role === 'admin';
}
