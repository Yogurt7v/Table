import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrganizationUsers,
  createOrganizationUser,
  updateOrganizationUser,
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
      objectIds,
    }: {
      userId: string;
      organizationId: string;
      role: IOrganizationUser['role'];
      objectIds?: string[];
    }) => createOrganizationUser(userId, organizationId, role, objectIds),
    onSettled: () => qc.invalidateQueries({ queryKey: ['organization_users'] }),
  });
}

export function useUpdateOrganizationUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: IOrganizationUser['role']; objects?: string[] } }) =>
      updateOrganizationUser(id, data),
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
