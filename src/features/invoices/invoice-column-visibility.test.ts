import { describe, it, expect } from 'vitest';
import { getVisibleColumnsForRole, getColumnSettingsItems, COLUMNS_BY_ROLE } from './invoice-column-visibility';

describe('invoice-column-visibility', () => {
  it('returns correct columns for each role', () => {
    const adminCols = getVisibleColumnsForRole('admin');
    const userCols = getVisibleColumnsForRole('user');
    const guestCols = getVisibleColumnsForRole('guest');
    const bossCols = getVisibleColumnsForRole('boss');
    const moderatorCols = getVisibleColumnsForRole('moderator');
    const nullCols = getVisibleColumnsForRole(null);

    // Admin has all columns
    expect(adminCols).toContain('actions');
    expect(adminCols).toContain('payment_mark');
    expect(adminCols).toContain('paid_date');

    // Moderator same as admin
    expect(moderatorCols).toEqual(adminCols);

    // Boss same as admin
    expect(bossCols).toEqual(adminCols);

    // User CAN create/edit/copy — actions column visible
    expect(userCols).toContain('actions');
    expect(userCols).not.toContain('payment_mark');
    expect(userCols).toContain('paid_date');
    expect(userCols).toContain('paid'); // paid visible but read-only
    expect(userCols).toContain('counterparty');
    expect(userCols).toContain('amount');

    // Guest read-only — no actions, no payment_mark, but CAN see paid_date
    expect(guestCols).not.toContain('actions');
    expect(guestCols).not.toContain('payment_mark');
    expect(guestCols).toContain('paid_date');

    // Null returns empty
    expect(nullCols).toEqual([]);
  });

  it('COLUMNS_BY_ROLE has entries for all named roles', () => {
    const namedRoles = ['admin', 'moderator', 'user', 'boss', 'guest'] as const;
    namedRoles.forEach((role) => {
      expect(COLUMNS_BY_ROLE[role]).toBeDefined();
      expect(Array.isArray(COLUMNS_BY_ROLE[role])).toBe(true);
    });
  });

  it('getColumnSettingsItems returns only allowed columns with labels', () => {
    const userItems = getColumnSettingsItems('user');
    const adminItems = getColumnSettingsItems('admin');

    // User items contain actions (edit/copy/files) but not restricted columns
    const userIds = userItems.map((i) => i.id);
    expect(userIds).toContain('actions');
    expect(userIds).not.toContain('payment_mark');
    // User CAN see paid_date
    expect(userIds).toContain('paid_date');

    // Admin items should contain all
    const adminIds = adminItems.map((i) => i.id);
    expect(adminIds).toContain('actions');
    expect(adminIds).toContain('payment_mark');
    expect(adminIds).toContain('paid_date');

    // All items should have labels
    userItems.forEach((item) => {
      expect(item.label).toBeTruthy();
      expect(typeof item.label).toBe('string');
    });
  });

  it('user has actions column, guest does not', () => {
    expect(getVisibleColumnsForRole('user')).toContain('actions');
    expect(getVisibleColumnsForRole('guest')).not.toContain('actions');
  });

  it('admin, moderator, boss have identical columns', () => {
    expect(getVisibleColumnsForRole('admin')).toEqual(getVisibleColumnsForRole('moderator'));
    expect(getVisibleColumnsForRole('admin')).toEqual(getVisibleColumnsForRole('boss'));
  });
});