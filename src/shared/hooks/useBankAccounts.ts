import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { getBalancesForOrgDate, upsertBalance } from '@/api/collections';

export function useBankAccounts(orgId: string, date: string) {
  return useQuery({
    queryKey: ['bank_accounts', orgId, date],
    queryFn: () => getBalancesForOrgDate(orgId, date),
    enabled: !!orgId && !!date,
  });
}

export function useUpdateBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      date,
      balance,
    }: {
      accountId: string;
      date: string;
      balance: number;
    }) => upsertBalance(accountId, date, balance),
    onSettled: () => qc.invalidateQueries({ queryKey: ['bank_accounts'] }),
    onError: () => notifications.show({ color: 'red', message: 'Не удалось сохранить остаток' }),
  });
}
