import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserSetting, upsertUserSetting } from '@/api/collections';
import { useAuth } from '@/shared/context/AuthContext';
import { getLastKnownUser } from '@/shared/auth/last-known-user';

export function useUserSetting(key: string) {
  const { user } = useAuth();
  const lastKnownUserId = getLastKnownUser()?.id;
  const effectiveUserId = user?.id ?? lastKnownUserId;
  return useQuery({
    queryKey: ['user_settings', effectiveUserId, key],
    queryFn: () => getUserSetting(effectiveUserId!, key).then((r) => r.value),
    enabled: !!effectiveUserId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertUserSetting(key: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const lastKnownUserId = getLastKnownUser()?.id;
  const effectiveUserId = user?.id ?? lastKnownUserId;
  return useMutation({
    mutationFn: (value: unknown) => upsertUserSetting(effectiveUserId!, key, value),
    onSettled: () => qc.invalidateQueries({ queryKey: ['user_settings', effectiveUserId, key] }),
    onError: (err) =>
      console.error(
        `upsertUserSetting('${key}') failed:`,
        err?.message,
        (err as { data?: unknown })?.data ?? '',
      ),
  });
}
