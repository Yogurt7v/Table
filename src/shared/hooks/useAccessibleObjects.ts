import { useMemo } from 'react';
import { useCurrentOrgUser } from '@/shared/hooks/useCurrentOrgUser';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';

export function useAccessibleObjects(orgId: string) {
  const assignment = useCurrentOrgUser(orgId);
  const { data: allObjects } = useAccountingObjects(orgId);

  return useMemo(() => {
    if (!assignment || !allObjects) return undefined;

    if (assignment.role === 'admin') return allObjects;

    if (!assignment.objects || assignment.objects.length === 0) return [];

    return allObjects.filter((obj) => assignment.objects!.includes(obj.id));
  }, [assignment, allObjects]);
}
