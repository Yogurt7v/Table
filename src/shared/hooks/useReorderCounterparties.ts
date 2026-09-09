import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAccountingObjectCounterpartyOrder } from '@/api/collections';
import type { IAccountingObject } from '@/shared/types';

interface ReorderCounterpartiesInput {
  objectId: string;
  counterpartyOrder: string[];
}

export function useReorderCounterparties(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ objectId, counterpartyOrder }: ReorderCounterpartiesInput) =>
      updateAccountingObjectCounterpartyOrder(objectId, counterpartyOrder),

    onMutate: async ({ objectId, counterpartyOrder }) => {
      await queryClient.cancelQueries({ queryKey: ['accounting_objects', orgId] });
      const previous = queryClient.getQueryData<IAccountingObject[]>([
        'accounting_objects',
        orgId,
      ]);

      queryClient.setQueryData<IAccountingObject[]>(['accounting_objects', orgId], (old) => {
        if (!old) return old;
        return old.map((obj) =>
          obj.id === objectId ? { ...obj, counterparty_order: counterpartyOrder } : obj,
        );
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['accounting_objects', orgId], context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_objects', orgId] });
    },
  });
}