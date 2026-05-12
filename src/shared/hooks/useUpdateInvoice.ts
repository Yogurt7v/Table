import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/api/client';
import type { IInvoice } from '@/shared/types';

export function useUpdateInvoice(orgId: string, date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<IInvoice> & { id: string }) =>
      pb.collection('invoices').update(id, data),

    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: ['invoices', orgId, date] });
      const previous = queryClient.getQueryData<IInvoice[]>(['invoices', orgId, date]);

      queryClient.setQueryData<IInvoice[]>(['invoices', orgId, date], (old) =>
        old?.map((inv) => (inv.id === updated.id ? { ...inv, ...updated } : inv)),
      );

      return { previous };
    },

    onError: (_err, _updated, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['invoices', orgId, date], context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId, date] });
    },
  });
}
