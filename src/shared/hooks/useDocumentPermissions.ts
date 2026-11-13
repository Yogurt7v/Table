import { useMemo } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';

/**
 * Can the signed-in user see the documents register (`/docs`) in one
 * organization?
 *
 * Reads the same cached `organization_users` list as `useCurrentUserRole` and
 * resolves the membership by `user_id` + `organization_id`. Until the list
 * resolves (and for an empty `orgId`) the answer is `false`, so callers can
 * destructure `canView` straight away and render a stub until rights arrive.
 */
export function useDocumentPermissions(orgId: string): { canView: boolean } {
  const { user } = useAuth();
  const { data: orgUsers } = useOrganizationUsers();

  const assignment = orgUsers?.find(
    (ou) => ou.user_id === user?.id && ou.organization_id === orgId,
  );

  return useMemo(
    () => ({ canView: assignment?.can_view_documents !== false }),
    [assignment],
  );
}
