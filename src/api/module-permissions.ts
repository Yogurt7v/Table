import { pb } from './client';
import type { IOrganizationUser } from '@/shared/types';

export const ORGANIZATION_USERS_COLLECTION = 'organization_users';

/**
 * Writes the module-visibility flags onto a membership. PocketBase's update is a
 * partial PATCH, so `role`, `objects` and the mail flags are left untouched.
 */
export function updateOrganizationUserModulePermissions(
  orgUserId: string,
  permissions: {
    can_view_invoices?: boolean;
    can_view_documents?: boolean;
  },
) {
  return pb.collection(ORGANIZATION_USERS_COLLECTION).update<IOrganizationUser>(orgUserId, {
    ...permissions,
  });
}
