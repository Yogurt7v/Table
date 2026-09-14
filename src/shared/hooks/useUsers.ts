import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { pb } from '@/api/client';
import {
  getUsers,
  createUser,
  deleteUser,
  updateUser,
  type UpdateUserData,
} from '@/api/collections';
import { useAuth } from '@/shared/context/AuthContext';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ login, password, name }: { login: string; password: string; name: string }) =>
      createUser(login, password, name),
    onSuccess: () => {
      qc.resetQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      qc.resetQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      notifications.show({
        title: 'Ошибка',
        message: err instanceof Error ? err.message : 'Не удалось удалить пользователя',
        color: 'red',
      });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateUserData) => updateUser(id, data),
    onSuccess: async (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      if (currentUser?.id === variables.id) {
        try {
          await pb.collection('users').authRefresh();
        } catch {
          // если токен истёк, глобальный перехватчик 401 уже разлогинит
        }
      }
    },
    onError: (err) => {
      notifications.show({
        title: 'Ошибка',
        message: err instanceof Error ? err.message : 'Не удалось обновить данные пользователя',
        color: 'red',
      });
    },
  });
}
