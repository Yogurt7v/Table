import { useMemo } from 'react';
import { useUsers } from './useUsers';
import type { IUser } from '@/shared/types';

export function useUserMap(): Map<string, IUser> {
  const { data: users } = useUsers();
  return useMemo(() => {
    const map = new Map<string, IUser>();
    if (users) {
      for (const u of users) {
        map.set(u.id, u);
      }
    }
    return map;
  }, [users]);
}
