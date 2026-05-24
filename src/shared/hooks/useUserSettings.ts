import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserSetting, upsertUserSetting } from '@/api/collections';
import { useAuth } from '@/shared/context/AuthContext';

export function useUserSetting(key: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user_settings', user?.id, key],
    queryFn: () => getUserSetting(user!.id, key).then((r) => r.value),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertUserSetting(key: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (value: unknown) => upsertUserSetting(user!.id, key, value),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: ['user_settings', user?.id, key] }),
  });
}
