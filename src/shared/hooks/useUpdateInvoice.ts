import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { updateInvoiceWithHistory } from '@/api/collections';
import type { IInvoice } from '@/shared/types';

export function useUpdateInvoice(orgId: string, date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      previousData,
      ...data
    }: Partial<IInvoice> & { id: string; previousData: Record<string, unknown> }) => {
      return updateInvoiceWithHistory(id, data, previousData);
    },

    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: ['invoices', orgId, date] });
      const previous = queryClient.getQueryData<IInvoice[]>(['invoices', orgId, date]);

      queryClient.setQueryData<IInvoice[]>(['invoices', orgId, date], (old) =>
        old?.map((inv) => (inv.id === updated.id ? { ...inv, ...updated } : inv)),
      );

      return { previous };
    },

    onError: (_err, _updated, context) => {
      console.error('Update invoice error:', _err);
      if (context?.previous) {
        queryClient.setQueryData(['invoices', orgId, date], context.previous);
      }
      notifications.show({ color: 'red', message: 'Не удалось сохранить изменения' });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId, date] });
      queryClient.invalidateQueries({ queryKey: ['invoice_history'] });
    },
  });
}
