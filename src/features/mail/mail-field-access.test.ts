import { describe, expect, it } from 'vitest';
import type { IOrganizationUser } from '@/shared/types';
import { getMailPermissions, type MailPermissions } from './mail-field-access';

const ALL_FALSE: MailPermissions = {
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
};

const PERMISSION_KEYS = Object.keys(ALL_FALSE) as (keyof MailPermissions)[];

function assignment(overrides: Partial<IOrganizationUser> = {}): IOrganizationUser {
  return {
    id: 'ou1',
    user_id: 'u1',
    organization_id: 'org1',
    role: 'user',
    ...overrides,
  };
}

/** A row from a collection whose mail flags were never backfilled or were coerced loosely. */
function looseAssignment(overrides: Record<string, unknown>): IOrganizationUser {
  return { ...assignment(), ...overrides };
}

function changedKeys(from: MailPermissions, to: MailPermissions): string[] {
  return PERMISSION_KEYS.filter((key) => from[key] !== to[key]);
}

describe('getMailPermissions', () => {
  it('grants every capability when all seven flags are true', () => {
    const permissions = getMailPermissions(
      assignment({
        role: 'admin',
        can_view_mails: true,
        can_create_incoming_mails: true,
        can_edit_incoming_mails: true,
        can_delete_incoming_mails: true,
        can_create_outgoing_mails: true,
        can_edit_outgoing_mails: true,
        can_delete_outgoing_mails: true,
      }),
    );

    expect(permissions).toEqual({
      canView: true,
      canCreateIncoming: true,
      canEditIncoming: true,
      canDeleteIncoming: true,
      canCreateOutgoing: true,
      canEditOutgoing: true,
      canDeleteOutgoing: true,
      canManageFiles: true,
      canViewHistory: true,
      canRestore: true,
      canViewArchive: true,
    });
  });

  it('lets a create+edit membership write but not delete, and sees no history', () => {
    const permissions = getMailPermissions(
      assignment({
        role: 'user',
        can_view_mails: true,
        can_create_incoming_mails: true,
        can_edit_incoming_mails: true,
        can_create_outgoing_mails: true,
        can_edit_outgoing_mails: true,
      }),
    );

    expect(permissions.canCreateIncoming).toBe(true);
    expect(permissions.canEditIncoming).toBe(true);
    expect(permissions.canDeleteIncoming).toBe(false);
    expect(permissions.canCreateOutgoing).toBe(true);
    expect(permissions.canEditOutgoing).toBe(true);
    expect(permissions.canDeleteOutgoing).toBe(false);
    expect(permissions.canManageFiles).toBe(true);
    expect(permissions.canViewHistory).toBe(false);
    expect(permissions.canRestore).toBe(false);
    expect(permissions.canViewArchive).toBe(false);
  });

  it('denies everything to a guest whose flags are all false', () => {
    const permissions = getMailPermissions(
      assignment({
        role: 'guest',
        can_view_mails: false,
        can_create_incoming_mails: false,
        can_edit_incoming_mails: false,
        can_delete_incoming_mails: false,
        can_create_outgoing_mails: false,
        can_edit_outgoing_mails: false,
        can_delete_outgoing_mails: false,
      }),
    );

    expect(permissions).toEqual(ALL_FALSE);
  });

  it('denies everything for a null assignment without throwing', () => {
    let permissions: MailPermissions | undefined;
    expect(() => {
      permissions = getMailPermissions(null);
    }).not.toThrow();
    expect(permissions).toEqual(ALL_FALSE);
  });

  it('denies everything for an undefined assignment', () => {
    expect(getMailPermissions(undefined)).toEqual(ALL_FALSE);
  });

  it('denies everything when every flag is absent from the row', () => {
    const permissions = getMailPermissions(assignment({ role: 'admin' }));

    expect(permissions).toEqual(ALL_FALSE);
  });

  it('treats the string "false" in place of a boolean as denied', () => {
    const permissions = getMailPermissions(
      looseAssignment({
        can_view_mails: 'false',
        can_create_incoming_mails: 'false',
        can_edit_incoming_mails: 'false',
        can_delete_incoming_mails: 'false',
        can_create_outgoing_mails: 'false',
        can_edit_outgoing_mails: 'false',
        can_delete_outgoing_mails: 'false',
      }),
    );

    expect(permissions).toEqual(ALL_FALSE);
  });

  it('treats a null flag as denied', () => {
    const permissions = getMailPermissions(
      looseAssignment({ can_view_mails: null, can_delete_incoming_mails: null }),
    );

    expect(permissions.canView).toBe(false);
    expect(permissions.canDeleteIncoming).toBe(false);
  });

  it('manages files when either register is editable, and not when neither is', () => {
    const incomingOnly = getMailPermissions(assignment({ can_edit_incoming_mails: true }));
    const outgoingOnly = getMailPermissions(assignment({ can_edit_outgoing_mails: true }));
    const neither = getMailPermissions(
      assignment({ can_create_incoming_mails: true, can_create_outgoing_mails: true }),
    );

    expect(incomingOnly.canManageFiles).toBe(true);
    expect(outgoingOnly.canManageFiles).toBe(true);
    expect(neither.canManageFiles).toBe(false);
  });

  it('ignores the role string: an admin without flags gets nothing', () => {
    expect(getMailPermissions(assignment({ role: 'admin' }))).toEqual(ALL_FALSE);
  });

  it('changes only the delete-derived keys when a single delete flag flips', () => {
    const baseline = getMailPermissions(assignment());

    const incomingDelete = getMailPermissions(assignment({ can_delete_incoming_mails: true }));
    const outgoingDelete = getMailPermissions(assignment({ can_delete_outgoing_mails: true }));

    expect(changedKeys(baseline, incomingDelete)).toEqual([
      'canDeleteIncoming',
      'canViewHistory',
      'canRestore',
      'canViewArchive',
    ]);
    expect(changedKeys(baseline, outgoingDelete)).toEqual([
      'canDeleteOutgoing',
      'canViewHistory',
      'canRestore',
      'canViewArchive',
    ]);
  });

  it('changes only its own key when a single non-derived flag flips', () => {
    const baseline = getMailPermissions(assignment());

    expect(changedKeys(baseline, getMailPermissions(assignment({ can_view_mails: true })))).toEqual(
      ['canView'],
    );
    expect(
      changedKeys(baseline, getMailPermissions(assignment({ can_create_incoming_mails: true }))),
    ).toEqual(['canCreateIncoming']);
    expect(
      changedKeys(baseline, getMailPermissions(assignment({ can_edit_outgoing_mails: true }))),
    ).toEqual(['canEditOutgoing', 'canManageFiles']);
  });

  it('keeps history/archive/restore locked together', () => {
    const permissions = getMailPermissions(assignment({ can_delete_incoming_mails: true }));

    expect(permissions.canViewHistory).toBe(true);
    expect(permissions.canRestore).toBe(permissions.canViewHistory);
    expect(permissions.canViewArchive).toBe(permissions.canViewHistory);
  });
});
