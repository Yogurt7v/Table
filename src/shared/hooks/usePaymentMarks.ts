import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPaymentMarks, createPaymentMark, deletePaymentMark } from '@/api/collections';

export function usePaymentMarks(orgId: string) {
  return useQuery({
    queryKey: ['payment_marks', orgId],
    queryFn: () => getPaymentMarks(orgId),
    enabled: !!orgId,
  });
}

export function useCreatePaymentMark(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      invoice_id: string;
      amount?: number | null;
      comment?: string;
    }) => createPaymentMark({ ...data, organization_id: orgId }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['payment_marks', orgId] }),
  });
}

export function useDeletePaymentMark(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePaymentMark(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['payment_marks', orgId] }),
  });
}
