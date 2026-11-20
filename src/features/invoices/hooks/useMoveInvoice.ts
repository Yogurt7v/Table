import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/api/client';

export function useMoveInvoice(orgId: string, date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, accounting_object_id }: { id: string; accounting_object_id: string }) =>
      pb.collection('invoices').update(id, { accounting_object_id }),

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId, date] });
    },
  });
}
