import { useQuery } from '@tanstack/react-query';
import { getAccountingObjects } from '@/api/collections';

export function useAccountingObjects(orgId: string) {
  return useQuery({
    queryKey: ['accounting_objects', orgId],
    queryFn: () => getAccountingObjects(orgId),
    enabled: !!orgId,
  });
}
