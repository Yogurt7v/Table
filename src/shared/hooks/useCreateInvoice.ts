import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInvoice, type CreateInvoiceInput } from '@/api/collections';
import { normalizeInvoice } from '@/shared/utils/normalize-invoice';
import type { IInvoice } from '@/shared/types';

export function useCreateInvoice(orgId: string, date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInvoiceInput) => createInvoice(data),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['invoices', orgId, date] });
    },

    onSuccess: (created) => {
      const normalized = normalizeInvoice(created);
      queryClient.setQueryData<IInvoice[]>(['invoices', orgId, date], (old) => {
        const next = old ? [...old.filter((i) => i.id !== normalized.id), normalized] : [normalized];
        return next.sort((a, b) => a.seq - b.seq);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId, date] });
    },
  });
}
