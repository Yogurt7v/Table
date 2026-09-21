import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { pb } from '@/api/client';
import {
  getDeletedInvoices,
  getAllDeletedInvoices,
  getDeletedInvoiceHistory,
  getDeletedInvoiceFiles,
  restoreDeletedInvoice,
} from '@/api/collections';

export function useDeletedInvoices(orgId: string, page: number, perPage: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orgId) return;
    const sub = pb.collection('deleted_invoices').subscribe('*', () => {
      queryClient.invalidateQueries({ queryKey: ['deleted_invoices', orgId] });
      queryClient.invalidateQueries({ queryKey: ['deleted_invoices', 'all', orgId] });
    });
    return () => {
      sub.then((unsub) => unsub());
    };
  }, [orgId, queryClient]);

  return useQuery({
    queryKey: ['deleted_invoices', orgId, page, perPage],
    queryFn: () => getDeletedInvoices(orgId, page, perPage),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  });
}

export function useAllDeletedInvoices(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['deleted_invoices', 'all', orgId],
    queryFn: () => getAllDeletedInvoices(orgId),
    enabled: enabled && !!orgId,
    retry: false,
  });
}

export function useDeletedInvoiceHistory(deletedInvoiceId: string | null) {
  return useQuery({
    queryKey: ['deleted_invoice_history', deletedInvoiceId],
    queryFn: () => getDeletedInvoiceHistory(deletedInvoiceId!),
    enabled: !!deletedInvoiceId,
  });
}

export function useDeletedInvoiceFiles(deletedInvoiceId: string | null) {
  return useQuery({
    queryKey: ['deleted_invoice_files', deletedInvoiceId],
    queryFn: () => getDeletedInvoiceFiles(deletedInvoiceId!),
    enabled: !!deletedInvoiceId,
  });
}

export function useRestoreInvoice(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deletedInvoiceId: string) => restoreDeletedInvoice(deletedInvoiceId),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        message: 'Счёт восстановлен из архива',
      });
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Не удалось восстановить счёт',
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['deleted_invoices', orgId] });
      qc.invalidateQueries({ queryKey: ['deleted_invoices', 'all', orgId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}