import { describe, expect, it } from 'vitest';
import type { IIncomingMail, IOrganizationUser, IOutgoingMail } from '@/shared/types';
import { getMailPermissions, mailSearchFieldsOf, type MailPermissions } from './mail-field-access';
import { foldSearchText, matchesFolded } from '@/shared/utils/search-text';

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

describe('mailSearchFieldsOf', () => {
  function incomingMail(overrides: Partial<IIncomingMail> = {}): IIncomingMail {
    return {
      id: 'im1',
      organization_id: 'org1',
      date: '2025-01-01',
      subject: 'Договор поставки',
      sender: 'ООО Ромашка',
      responsible: 'u1',
      ...overrides,
    } as IIncomingMail;
  }

  function outgoingMail(overrides: Partial<IOutgoingMail> = {}): IOutgoingMail {
    return {
      id: 'om1',
      organization_id: 'org1',
      date: '2025-01-01',
      subject: 'Счёт на оплату',
      recipient: 'ООО Ромашка',
      responsible: 'u1',
      ...overrides,
    } as IOutgoingMail;
  }

  it('returns the six searchable fields for incoming mail', () => {
    const fields = mailSearchFieldsOf(
      incomingMail({ number: '123', sender_outgoing_number: '456', comment: 'test', responsible_name: 'Иван' }),
      'incoming',
    );

    expect(fields).toEqual(['123', 'ООО Ромашка', '456', 'Договор поставки', 'test', 'Иван']);
  });

  it('returns the six searchable fields for outgoing mail', () => {
    const fields = mailSearchFieldsOf(
      outgoingMail({ outgoing_number: '789', counterparty_incoming_number: '012', comment: 'note', responsible_name: 'Пётр' }),
      'outgoing',
    );

    expect(fields).toEqual(['789', 'ООО Ромашка', '012', 'Счёт на оплату', 'note', 'Пётр']);
  });

  it('matches a Cyrillic subject with a lowercased query', () => {
    const mail = incomingMail({ subject: 'Договор поставки' });
    const folded = foldSearchText('договор');

    expect(matchesFolded(mailSearchFieldsOf(mail, 'incoming'), folded)).toBe(true);
  });

  it('matches a Cyrillic subject with an uppercase query', () => {
    const mail = incomingMail({ subject: 'Договор поставки' });
    const folded = foldSearchText('ДОГОВОР');

    expect(matchesFolded(mailSearchFieldsOf(mail, 'incoming'), folded)).toBe(true);
  });

  it('matches an ASCII query against a Latin subject', () => {
    const mail = incomingMail({ subject: 'Contract agreement' });
    const folded = foldSearchText('contract');

    expect(matchesFolded(mailSearchFieldsOf(mail, 'incoming'), folded)).toBe(true);
  });

  it('matches a sender name case-insensitively', () => {
    const mail = incomingMail({ sender: 'ООО Ромашка' });
    const folded = foldSearchText('ромашка');

    expect(matchesFolded(mailSearchFieldsOf(mail, 'incoming'), folded)).toBe(true);
  });

  it('matches a mail number', () => {
    const mail = incomingMail({ number: '123-А' });
    const folded = foldSearchText('123-а');

    expect(matchesFolded(mailSearchFieldsOf(mail, 'incoming'), folded)).toBe(true);
  });

  it('returns true for an empty query', () => {
    const mail = incomingMail();

    expect(matchesFolded(mailSearchFieldsOf(mail, 'incoming'), '')).toBe(true);
  });

  it('returns false when no field matches', () => {
    const mail = incomingMail({ subject: 'Договор поставки', sender: 'ООО Ромашка' });
    const folded = foldSearchText('несуществующее');

    expect(matchesFolded(mailSearchFieldsOf(mail, 'incoming'), folded)).toBe(false);
  });
});

describe('client-side pagination', () => {
  const PAGE_SIZE = 20;

  function pageCount(totalItems: number): number {
    return totalItems === 0 ? 0 : Math.ceil(totalItems / PAGE_SIZE);
  }

  function pageSlice<T>(items: T[], page: number): T[] {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }

  it('computes pageCount for an empty list', () => {
    expect(pageCount(0)).toBe(0);
  });

  it('computes pageCount for a partial page', () => {
    expect(pageCount(5)).toBe(1);
  });

  it('computes pageCount for exactly one page', () => {
    expect(pageCount(20)).toBe(1);
  });

  it('computes pageCount for one item over a full page', () => {
    expect(pageCount(21)).toBe(2);
  });

  it('computes pageCount for multiple pages', () => {
    expect(pageCount(45)).toBe(3);
  });

  it('slices the first page correctly', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(pageSlice(items, 1)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('slices the second page correctly', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(pageSlice(items, 2)).toEqual([20, 21, 22, 23, 24]);
  });

  it('returns an empty slice for a page beyond the last', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(pageSlice(items, 2)).toEqual([]);
  });
});
