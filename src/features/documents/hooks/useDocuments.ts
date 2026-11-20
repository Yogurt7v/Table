import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDocumentComment,
  archiveDocument,
  createManualDocument,
  deleteDocumentComment,
  deleteDocumentFile,
  getAllDocumentComments,
  getAllDocumentFiles,
  getArchivedDocuments,
  getDocumentById,
  getDocumentComments,
  getDocumentFiles,
  getDocumentHistory,
  getOrgInvoices,
  getSourceInvoiceInfo,
  listDocuments,
  markPaymentCancelled,
  moveDocument,
  restoreDocument,
  searchDocumentIdsByComment,
  updateDocumentStatus,
  updateDocumentWithHistory,
  uploadDocumentFile,
  type CreateDocumentInput,
} from '@/api/documents';
import type {
  DocumentHistoryType,
  IDocument,
  IDocumentComment,
  IDocumentFile,
} from '@/shared/types';

export function useDocuments(
  organizationId: string,
  role: 'admin' | 'moderator' | 'user' | 'guest' | 'boss' | null,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: ['documents', organizationId, role, userId],
    queryFn: () =>
      listDocuments({
        organizationId,
        role: role ?? 'guest',
        userId: userId ?? '',
      }),
    enabled: !!organizationId && !!role,
    placeholderData: keepPreviousData,
  });
}

export function useArchivedDocuments(organizationId: string, enabled = true) {
  return useQuery({
    queryKey: ['documents-archive', organizationId],
    queryFn: () => getArchivedDocuments(organizationId),
    enabled: !!organizationId && enabled,
  });
}

export function useDocument(documentId: string | null) {
  return useQuery({
    queryKey: ['document', documentId],
    queryFn: () => getDocumentById(documentId!),
    enabled: !!documentId,
  });
}

export function useAllDocumentFiles(organizationId: string) {
  return useQuery({
    queryKey: ['document-files-all', organizationId],
    queryFn: () => getAllDocumentFiles(organizationId),
    enabled: !!organizationId,
  });
}

export function useAllDocumentComments(organizationId: string) {
  return useQuery({
    queryKey: ['document-comments-all', organizationId],
    queryFn: () => getAllDocumentComments(organizationId),
    enabled: !!organizationId,
  });
}

export function useOrgInvoices(organizationId: string) {
  return useQuery({
    queryKey: ['invoices-for-documents', organizationId],
    queryFn: () => getOrgInvoices(organizationId),
    enabled: !!organizationId,
  });
}

export function useDocumentFiles(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-files', documentId],
    queryFn: () => getDocumentFiles(documentId!),
    enabled: !!documentId,
  });
}

export function useDocumentComments(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-comments', documentId],
    queryFn: () => getDocumentComments(documentId!),
    enabled: !!documentId,
  });
}

export function useDocumentHistory(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-history', documentId],
    queryFn: () => getDocumentHistory(documentId!),
    enabled: !!documentId,
  });
}

export function useDocumentSource(document: IDocument | null) {
  return useQuery({
    queryKey: ['document-source', document?.source_invoice_id ?? ''],
    queryFn: () => getSourceInvoiceInfo(document!),
    enabled: !!document?.source_invoice_id,
  });
}

export function useDocumentCommentSearch(organizationId: string, query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['document-comment-search', organizationId, query],
    queryFn: () => searchDocumentIdsByComment(organizationId, query),
    enabled: enabled && !!organizationId && !!query.trim(),
  });
}

function useInvalidateDocuments(organizationId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['documents', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['documents-archive', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['document'] });
  };
}

export function useCreateManualDocument(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  return useMutation({
    mutationFn: (input: CreateDocumentInput) => createManualDocument(input),
    onSuccess: invalidate,
  });
}

export function useUpdateDocument(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      document: IDocument;
      data: Partial<IDocument>;
      type?: DocumentHistoryType;
      previousData: Record<string, unknown>;
    }) =>
      updateDocumentWithHistory(
        vars.document,
        vars.data,
        vars.type ?? 'document_updated',
        vars.previousData,
      ),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['document-history', updated.id] });
      invalidate();
    },
  });
}

export function useUpdateDocumentStatus(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { document: IDocument; provided?: boolean; confirmed?: boolean }) =>
      updateDocumentStatus(vars.document, { provided: vars.provided, confirmed: vars.confirmed }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['document-history', updated.id] });
      invalidate();
    },
  });
}

export function useUploadDocumentFile(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { document: IDocument; file: File; displayName?: string }) =>
      uploadDocumentFile(vars.document, vars.file, vars.displayName),
    onSuccess: (_file, vars) => {
      queryClient.invalidateQueries({ queryKey: ['document-files', vars.document.id] });
      queryClient.invalidateQueries({ queryKey: ['document-history', vars.document.id] });
      invalidate();
    },
  });
}

export function useDeleteDocumentFile(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { document: IDocument; file: IDocumentFile }) =>
      deleteDocumentFile(vars.document, vars.file),
    onSuccess: (_updated, vars) => {
      queryClient.invalidateQueries({ queryKey: ['document-files', vars.document.id] });
      queryClient.invalidateQueries({ queryKey: ['document-history', vars.document.id] });
      invalidate();
    },
  });
}

export function useAddDocumentComment(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { document: IDocument; text: string }) =>
      addDocumentComment(vars.document, vars.text),
    onSuccess: (_comment, vars) => {
      queryClient.invalidateQueries({ queryKey: ['document-comments', vars.document.id] });
      queryClient.invalidateQueries({ queryKey: ['document-history', vars.document.id] });
      invalidate();
    },
  });
}

export function useDeleteDocumentComment(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { document: IDocument; comment: IDocumentComment }) =>
      deleteDocumentComment(vars.document, vars.comment),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: ['document-comments', vars.document.id] });
      queryClient.invalidateQueries({ queryKey: ['document-history', vars.document.id] });
      invalidate();
    },
  });
}

export function useArchiveDocument(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  return useMutation({
    mutationFn: (vars: { document: IDocument; reason: string }) =>
      archiveDocument(vars.document, vars.reason),
    onSuccess: invalidate,
  });
}

export function useRestoreDocument(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  return useMutation({
    mutationFn: (document: IDocument) => restoreDocument(document),
    onSuccess: invalidate,
  });
}

export function useMoveDocument(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  return useMutation({
    mutationFn: (vars: { document: IDocument; accountingObjectId: string }) =>
      moveDocument(vars.document, vars.accountingObjectId),
    onSuccess: invalidate,
  });
}

export function useMarkPaymentCancelled(organizationId: string) {
  const invalidate = useInvalidateDocuments(organizationId);
  return useMutation({
    mutationFn: (vars: { document: IDocument; cancelled: boolean }) =>
      markPaymentCancelled(vars.document, vars.cancelled),
    onSuccess: invalidate,
  });
}
