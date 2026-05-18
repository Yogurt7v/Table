import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { deleteInvoice } from '@/api/collections';
import type { IInvoice } from '@/shared/types';

export function useDeleteInvoice(orgId: string, date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['invoices', orgId, date] });
      const previous = queryClient.getQueryData<IInvoice[]>(['invoices', orgId, date]);
      queryClient.setQueryData<IInvoice[]>(['invoices', orgId, date], (old) =>
        old?.filter((inv) => inv.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['invoices', orgId, date], context.previous);
      }
      notifications.show({ color: 'red', message: 'Не удалось удалить счёт' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId, date] });
    },
  });
}
