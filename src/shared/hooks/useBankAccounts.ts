import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBankAccounts, updateBankAccountBalance } from '@/api/collections';

export function useBankAccounts(orgId: string) {
  return useQuery({
    queryKey: ['bank_accounts', orgId],
    queryFn: () => getBankAccounts(orgId),
    enabled: !!orgId,
  });
}

export function useUpdateBankAccountBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, balance }: { id: string; balance: number }) =>
      updateBankAccountBalance(id, balance),
    onSettled: () => qc.invalidateQueries({ queryKey: ['bank_accounts'] }),
  });
}
