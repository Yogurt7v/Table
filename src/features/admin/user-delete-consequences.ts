import type { IOrganization, IOrganizationUser } from '@/shared/types';

export const ROLE_LABELS: Record<IOrganizationUser['role'], string> = {
  admin: 'Администратор',
  moderator: 'Модератор',
  user: 'Пользователь',
  boss: 'Босс',
  guest: 'Гость',
};

export interface UserDeleteMembership {
  orgName: string;
  roleLabel: string;
}

export interface UserDeleteConsequences {
  memberships: UserDeleteMembership[];
  soleAdminOf: string[];
}

export function buildUserDeleteConsequences(
  userId: string,
  orgUsers: IOrganizationUser[],
  organizations: IOrganization[],
): UserDeleteConsequences {
  const memberships = orgUsers
    .filter((ou) => ou.user_id === userId)
    .map((ou) => ({
      orgName:
        organizations.find((org) => org.id === ou.organization_id)?.name ?? 'Неизвестная организация',
      roleLabel: ROLE_LABELS[ou.role] ?? ou.role,
    }));

  const soleAdminOf = organizations
    .filter((org) => {
      const admins = orgUsers.filter(
        (ou) => ou.organization_id === org.id && ou.role === 'admin',
      );
      return admins.length === 1 && admins[0]?.user_id === userId;
    })
    .map((org) => org.name);

  return { memberships, soleAdminOf };
}
