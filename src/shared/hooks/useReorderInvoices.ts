import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/api/client';
import type { IInvoice } from '@/shared/types';

export function useReorderInvoices(orgId: string, date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, i) =>
        pb.collection('invoices').update(id, { seq: i + 1 }),
      );
      await Promise.all(updates);
    },

    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ['invoices', orgId, date] });
      const previous = queryClient.getQueryData<IInvoice[]>(['invoices', orgId, date]);

      queryClient.setQueryData<IInvoice[]>(['invoices', orgId, date], (old) => {
        if (!old) return [];
        const ordered = orderedIds
          .map((id) => old.find((inv) => inv.id === id))
          .filter((inv): inv is IInvoice => inv != null);
        return ordered.map((inv, i) => ({ ...inv, seq: i + 1 }));
      });

      return { previous };
    },

    onError: (_err, _orderedIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['invoices', orgId, date], context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId, date] });
    },
  });
}
