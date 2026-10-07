import type { IOrganizationUser } from '@/shared/types';

/** Flat, UI-facing view of the seven authoritative `organization_users` mail flags. */
export interface MailPermissions {
  canView: boolean;
  canCreateIncoming: boolean;
  canEditIncoming: boolean;
  canDeleteIncoming: boolean;
  canCreateOutgoing: boolean;
  canEditOutgoing: boolean;
  canDeleteOutgoing: boolean;
  canManageFiles: boolean;
  canViewHistory: boolean;
  canRestore: boolean;
  canViewArchive: boolean;
}

/**
 * Every capability denied. Also the answer for a membership that has not loaded
 * yet, so callers can destructure the result without a null check — and the
 * frozen literal gives the "loading" state a stable identity across renders.
 */
export const NO_MAIL_PERMISSIONS: MailPermissions = Object.freeze({
  canView: false,
  canCreateIncoming: false,
  canEditIncoming: false,
  canDeleteIncoming: false,
  canCreateOutgoing: false,
  canEditOutgoing: false,
  canDeleteOutgoing: false,
  canManageFiles: false,
  canViewHistory: false,
  canRestore: false,
  canViewArchive: false,
});

/**
 * The seven `can_*_mails` columns on `organization_users` are the whole source of
 * truth here; the `role` string is never consulted. Backfill per role makes the
 * flags agree with the invoice matrix, but from this module's point of view an
 * admin whose `can_view_mails` is false sees nothing — the column is the
 * permission, so a caller who needs role semantics goes through
 * `useCurrentUserRole` instead.
 *
 * Flags are optional on `IOrganizationUser`, and a row from an unbackfilled
 * collection arrives without them, so every read is coerced with `=== true`: a
 * missing flag, a `null`, or the string `"false"` from a loose payload all deny
 * rather than fall through to a truthy value.
 */
export function getMailPermissions(
  assignment: IOrganizationUser | null | undefined,
): MailPermissions {
  if (!assignment) return NO_MAIL_PERMISSIONS;

  const canEditIncoming = assignment.can_edit_incoming_mails === true;
  const canEditOutgoing = assignment.can_edit_outgoing_mails === true;
  const canDeleteIncoming = assignment.can_delete_incoming_mails === true;
  const canDeleteOutgoing = assignment.can_delete_outgoing_mails === true;
  // History, archive and restore are one moderator-class capability: an audit
  // trail of who deleted what exists only because the letters can be deleted,
  // and deletion is what fills the archive. Mirrors `getInvoicePermissions`,
  // where `canViewHistory` is admin/moderator rather than its own column.
  const canViewHistory = canDeleteIncoming || canDeleteOutgoing;

  return {
    canView: assignment.can_view_mails === true,
    canCreateIncoming: assignment.can_create_incoming_mails === true,
    canEditIncoming,
    canDeleteIncoming,
    canCreateOutgoing: assignment.can_create_outgoing_mails === true,
    canEditOutgoing,
    canDeleteOutgoing,
    canManageFiles: canEditIncoming || canEditOutgoing,
    canViewHistory,
    canRestore: canViewHistory,
    canViewArchive: canViewHistory,
  };
}
