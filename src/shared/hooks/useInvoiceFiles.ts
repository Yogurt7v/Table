import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getInvoiceFilesByOrg,
  createInvoiceFile,
  deleteInvoiceFile,
} from '@/api/collections';

export function useOrgInvoiceFiles(orgId: string) {
  return useQuery({
    queryKey: ['invoice_files', orgId],
    queryFn: () => getInvoiceFilesByOrg(orgId),
    enabled: !!orgId,
  });
}

export function useCreateInvoiceFile(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, file, name }: { invoiceId: string; file: File; name: string }) =>
      createInvoiceFile(invoiceId, orgId, file, name),
    onSettled: () => qc.invalidateQueries({ queryKey: ['invoice_files', orgId] }),
  });
}

export function useDeleteInvoiceFile(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInvoiceFile(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['invoice_files', orgId] }),
  });
}
