import { describe, it, expect } from 'vitest';
import { buildUserDeleteConsequences } from './user-delete-consequences';
import type { IOrganization, IOrganizationUser } from '@/shared/types';

const organizations: IOrganization[] = [
  { id: 'org1', name: 'ООО Альфа', color: '#228be6' },
  { id: 'org2', name: 'ООО Бета', color: '#40c057' },
];

const ou = (
  id: string,
  user_id: string,
  organization_id: string,
  role: IOrganizationUser['role'],
): IOrganizationUser => ({ id, user_id, organization_id, role });

describe('buildUserDeleteConsequences', () => {
  it('lists memberships with organization names and role labels', () => {
    const result = buildUserDeleteConsequences(
      'u1',
      [
        ou('a1', 'u1', 'org1', 'moderator'),
        ou('a2', 'u1', 'org2', 'guest'),
        ou('a3', 'u2', 'org1', 'user'),
      ],
      organizations,
    );
    expect(result.memberships).toEqual([
      { orgName: 'ООО Альфа', roleLabel: 'Модератор' },
      { orgName: 'ООО Бета', roleLabel: 'Гость' },
    ]);
    expect(result.soleAdminOf).toEqual([]);
  });

  it('flags organizations where the user is the only admin', () => {
    const result = buildUserDeleteConsequences(
      'u1',
      [ou('a1', 'u1', 'org1', 'admin'), ou('a2', 'u1', 'org2', 'admin'), ou('a3', 'u2', 'org2', 'admin')],
      organizations,
    );
    expect(result.soleAdminOf).toEqual(['ООО Альфа']);
    expect(result.memberships).toHaveLength(2);
  });

  it('does not flag when another admin exists', () => {
    const result = buildUserDeleteConsequences(
      'u1',
      [ou('a1', 'u1', 'org1', 'admin'), ou('a2', 'u2', 'org1', 'admin')],
      organizations,
    );
    expect(result.soleAdminOf).toEqual([]);
  });

  it('returns empty for a user without memberships', () => {
    const result = buildUserDeleteConsequences('u9', [], organizations);
    expect(result.memberships).toEqual([]);
    expect(result.soleAdminOf).toEqual([]);
  });

  it('falls back to placeholder name for unknown organization', () => {
    const result = buildUserDeleteConsequences('u1', [ou('a1', 'u1', 'ghost', 'user')], organizations);
    expect(result.memberships[0]?.orgName).toBe('Неизвестная организация');
  });
});
