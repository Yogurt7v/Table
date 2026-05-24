import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPaymentMarks, createPaymentMark, deletePaymentMark } from '@/api/collections';
import { pb } from '@/api/client';

export function usePaymentMarks(orgId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orgId) return;
    const sub = pb.collection('payment_marks').subscribe('*', () => {
      queryClient.invalidateQueries({ queryKey: ['payment_marks', orgId] });
    });
    return () => {
      sub.then((unsub) => unsub());
    };
  }, [orgId, queryClient]);

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
