import { useMemo } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import { getMailPermissions, type MailPermissions } from '@/features/mail/mail-field-access';

/**
 * Mail capabilities of the signed-in user in one organization.
 *
 * Reads the same cached `organization_users` list as `useCurrentUserRole` and
 * `useAccessibleObjects`, so no extra request is made, and resolves the
 * membership the same way — by `user_id` + `organization_id`. Until that list
 * resolves (and for an empty `orgId`) the answer is the all-false shape rather
 * than `undefined`, so a caller can destructure straight away and simply render
 * nothing until the rights arrive. Use `useCurrentUserRole` when the role string
 * itself is what you need: the flags, not the role, decide mail access.
 */
export function useMailPermissions(orgId: string): MailPermissions {
  const { user } = useAuth();
  const { data: orgUsers } = useOrganizationUsers();

  const assignment = orgUsers?.find(
    (ou) => ou.user_id === user?.id && ou.organization_id === orgId,
  );

  // `assignment` comes straight out of the query cache, so it keeps its identity
  // across renders and the memo holds while the permissions are unchanged.
  return useMemo(() => getMailPermissions(assignment), [assignment]);
}
