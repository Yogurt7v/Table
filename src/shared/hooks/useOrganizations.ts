import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { getOrganizations, createOrganization, updateOrganization, deleteOrganization } from '@/api/collections';

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: getOrganizations,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      createOrganization(name, color),
    onSettled: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
    onError: () => notifications.show({ color: 'red', message: 'Не удалось создать организацию' }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, color }: { id: string; name: string; color: string }) =>
      updateOrganization(id, name, color),
    onSettled: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
    onError: () => notifications.show({ color: 'red', message: 'Не удалось сохранить организацию' }),
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOrganization(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
    onError: () => notifications.show({ color: 'red', message: 'Не удалось удалить организацию' }),
  });
}
