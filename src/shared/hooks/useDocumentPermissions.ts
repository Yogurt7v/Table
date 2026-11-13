import { useMemo } from 'react';
import { useCurrentOrgUser } from '@/shared/hooks/useCurrentOrgUser';

/**
 * Can the signed-in user see the documents register (`/docs`) in one
 * organization?
 *
 * Reads the same cached `organization_users` list as `useCurrentUserRole` and
 * `useAccessibleObjects`, so no extra request is made, and resolves the
 * membership by `user_id` + `organization_id`. Until the list
 * resolves (and for an empty `orgId`) the answer is `false`, so callers can
 * destructure `canView` straight away and render a stub until rights arrive.
 */
export function useDocumentPermissions(orgId: string): { canView: boolean } {
  const assignment = useCurrentOrgUser(orgId);

  return useMemo(
    () => ({ canView: assignment?.can_view_documents !== false }),
    [assignment],
  );
}
