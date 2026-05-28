import { useMemo } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';

export function useAccessibleObjects(orgId: string) {
  const { user } = useAuth();
  const { data: orgUsers } = useOrganizationUsers();
  const { data: allObjects } = useAccountingObjects(orgId);

  return useMemo(() => {
    if (!user || !orgUsers || !allObjects) return undefined;

    const assignment = orgUsers.find(
      (ou) => ou.user_id === user.id && ou.organization_id === orgId,
    );
    if (!assignment) return [];

    if (assignment.role === 'admin') return allObjects;

    if (!assignment.objects || assignment.objects.length === 0) return [];

    return allObjects.filter((obj) => assignment.objects!.includes(obj.id));
  }, [user, orgUsers, allObjects, orgId]);
}
