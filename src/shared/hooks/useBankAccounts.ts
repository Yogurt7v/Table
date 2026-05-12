import { useQuery } from '@tanstack/react-query';
import { getBankAccounts } from '@/api/collections';

export function useBankAccounts(orgId: string) {
  return useQuery({
    queryKey: ['bank_accounts', orgId],
    queryFn: () => getBankAccounts(orgId),
    enabled: !!orgId,
  });
}
