/** Управление правами пользователя организации на действия с почтой. */

import { pb } from '../client.ts';
import type { IOrganizationUser, MailPermissionFlags } from '@/shared/types';
import { ORGANIZATION_USERS_COLLECTION } from './constants.ts';

/**
 * Writes the seven mail flags onto a membership. PocketBase's update is a
 * partial PATCH, so `role` and `objects` are left untouched — this does not go
 * through updateOrganizationUser because that signature has no room for the
 * flags, and widening it would change a function this task must not touch.
 */
export function updateOrganizationUserMailPermissions(
  orgUserId: string,
  permissions: MailPermissionFlags,
) {
  return pb
    .collection(ORGANIZATION_USERS_COLLECTION)
    .update<IOrganizationUser>(orgUserId, { ...permissions });
}
