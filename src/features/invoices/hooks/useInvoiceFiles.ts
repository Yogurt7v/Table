import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getInvoiceFilesByOrg,
  createInvoiceFile,
  softDeleteInvoiceFile,
  createInvoiceHistoryRecord,
} from '@/api/collections';
import type { IInvoiceFile } from '@/shared/types';

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
    onSuccess: (created, vars) => {
      createInvoiceHistoryRecord(vars.invoiceId, {
        type: 'file_added',
        previous_data: {
          file_name: created.name,
          file: created.file,
          file_id: created.id,
        },
      }).catch((e) => {
        // History creation failure should not break the file upload
        console.error('Failed to create file history record:', e);
      });
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['invoice_files', orgId] });
      qc.invalidateQueries({ queryKey: ['invoice_files_detail', vars.invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoice_history', vars.invoiceId] });
    },
  });
}

export function useDeleteInvoiceFile(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileRecord: IInvoiceFile) => softDeleteInvoiceFile(fileRecord.id),
    onSuccess: (deleted, fileRecord) => {
      createInvoiceHistoryRecord(fileRecord.invoice_id, {
        type: 'file_removed',
        previous_data: {
          file_name: deleted.name,
          file: deleted.file,
          file_id: deleted.id,
        },
      }).catch((e) => {
        // History creation failure should not break the file delete
        console.error('Failed to create file history record:', e);
      });
    },
    onSettled: (_data, _err, fileRecord) => {
      qc.invalidateQueries({ queryKey: ['invoice_files', orgId] });
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'invoice_files_detail',
      });
      qc.invalidateQueries({ queryKey: ['invoice_history', fileRecord.invoice_id] });
    },
  });
}
