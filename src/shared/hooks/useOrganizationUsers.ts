import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrganizationUsers,
  createOrganizationUser,
  updateOrganizationUserRole,
  deleteOrganizationUser,
} from '@/api/collections';
import type { IOrganizationUser } from '@/shared/types';

export function useOrganizationUsers() {
  return useQuery({
    queryKey: ['organization_users'],
    queryFn: getOrganizationUsers,
  });
}

export function useCreateOrganizationUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      organizationId,
      role,
    }: {
      userId: string;
      organizationId: string;
      role: IOrganizationUser['role'];
    }) => createOrganizationUser(userId, organizationId, role),
    onSettled: () => qc.invalidateQueries({ queryKey: ['organization_users'] }),
  });
}

export function useUpdateOrganizationUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: IOrganizationUser['role'] }) =>
      updateOrganizationUserRole(id, role),
    onSettled: () => qc.invalidateQueries({ queryKey: ['organization_users'] }),
  });
}

export function useDeleteOrganizationUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOrganizationUser(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['organization_users'] }),
  });
}
