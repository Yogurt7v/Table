import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { IDocument, IDocumentComment, IDocumentFile, IDocumentHistory } from '@/shared/types';
import {
  useAllDocumentComments,
  useAllDocumentFiles,
  useDocumentSource,
  useOrgInvoices,
  useArchivedDocuments,
  useCreateManualDocument,
  useDocument,
  useDocumentCommentSearch,
  useDocumentComments,
  useDocumentFiles,
  useDocumentHistory,
  useDocuments,
  useUpdateDocument,
  useUploadDocumentFile,
} from './useDocuments';

const api = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  getArchivedDocuments: vi.fn(),
  getDocumentById: vi.fn(),
  getAllDocumentFiles: vi.fn(),
  getAllDocumentComments: vi.fn(),
  getOrgInvoices: vi.fn(),
  getDocumentFiles: vi.fn(),
  getDocumentComments: vi.fn(),
  getDocumentHistory: vi.fn(),
  getSourceInvoiceInfo: vi.fn(),
  searchDocumentIdsByComment: vi.fn(),
  createManualDocument: vi.fn(),
  updateDocumentWithHistory: vi.fn(),
  updateDocumentStatus: vi.fn(),
  uploadDocumentFile: vi.fn(),
  deleteDocumentFile: vi.fn(),
  addDocumentComment: vi.fn(),
  deleteDocumentComment: vi.fn(),
  archiveDocument: vi.fn(),
  restoreDocument: vi.fn(),
  moveDocument: vi.fn(),
  markPaymentCancelled: vi.fn(),
}));

vi.mock('@/api/documents', () => api);

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const document: IDocument = {
  id: 'doc1',
  organization_id: 'org1',
  accounting_object_id: 'obj1',
  seq: 1,
  payment_date: '2026-10-14',
  counterparty: 'ООО Тест',
  purpose: 'Назначение',
  contract_no: '',
  invoice_no: 'СЧ-1',
  amount: 1000,
  responsible_id: 'u1',
  created_by: 'u2',
  creation_mode: 'auto',
  sync_locked: false,
  provided: false,
  confirmed: false,
  payment_cancelled: false,
  is_deleted: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDocuments', () => {
  it('does not run without organization or role', () => {
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useDocuments('', null, 'u1'), { wrapper: wrapper(queryClient) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.listDocuments).not.toHaveBeenCalled();
  });

  it('loads documents with normalized role and user id', async () => {
    api.listDocuments.mockResolvedValue([document]);
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useDocuments('org1', 'user', 'u1'), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.listDocuments).toHaveBeenCalledWith({ organizationId: 'org1', role: 'user', userId: 'u1' });
    expect(result.current.data).toEqual([document]);
  });

  it('keeps previous data while refetching', async () => {
    api.listDocuments.mockResolvedValue([document]);
    const queryClient = makeQueryClient();
    const { result, rerender } = renderHook(({ org }) => useDocuments(org, 'admin', 'u1'), {
      initialProps: { org: 'org1' },
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    api.listDocuments.mockResolvedValue([{ ...document, id: 'doc2' }]);

    rerender({ org: 'org2' });
    expect(result.current.data?.map((item) => item.id)).toEqual(['doc1']);
  });
});

describe('document queries', () => {
  it('uses distinct query keys', async () => {
    const doc: IDocument = { ...document, source_invoice_id: 'inv1' };
    const file: IDocumentFile = { id: 'file1', document_id: 'doc1', organization_id: 'org1', file: 'a.pdf', name: 'a.pdf' };
    const comment: IDocumentComment = { id: 'comment1', document_id: 'doc1', organization_id: 'org1', author: 'u1', text: 'text' };
    const history: IDocumentHistory = { id: 'h1', document_id: 'doc1', organization_id: 'org1', changed_at: '2026-10-14T10:00:00.000Z', type: 'document_updated', previous_data: {} };

    api.getArchivedDocuments.mockResolvedValue([doc]);
    api.getDocumentById.mockResolvedValue(doc);
    api.getAllDocumentFiles.mockResolvedValue([file]);
    api.getAllDocumentComments.mockResolvedValue([comment]);
    api.getOrgInvoices.mockResolvedValue([]);
    api.getDocumentFiles.mockResolvedValue([file]);
    api.getDocumentComments.mockResolvedValue([comment]);
    api.getDocumentHistory.mockResolvedValue([history]);
    api.getSourceInvoiceInfo.mockResolvedValue(null);
    api.searchDocumentIdsByComment.mockResolvedValue(['doc1']);

    const queryClient = makeQueryClient();
    const w = wrapper(queryClient);

    const archived = renderHook(() => useArchivedDocuments('org1'), { wrapper: w });
    const one = renderHook(() => useDocument('doc1'), { wrapper: w });
    const allFiles = renderHook(() => useAllDocumentFiles('org1'), { wrapper: w });
    const allComments = renderHook(() => useAllDocumentComments('org1'), { wrapper: w });
    const invoices = renderHook(() => useOrgInvoices('org1'), { wrapper: w });
    const files = renderHook(() => useDocumentFiles('doc1'), { wrapper: w });
    const comments = renderHook(() => useDocumentComments('doc1'), { wrapper: w });
    const histories = renderHook(() => useDocumentHistory('doc1'), { wrapper: w });
    const source = renderHook(() => useDocumentSource(doc), { wrapper: w });
    const search = renderHook(() => useDocumentCommentSearch('org1', 'query', true), { wrapper: w });

    await waitFor(() => expect(archived.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(one.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(allFiles.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(allComments.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(invoices.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(files.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(comments.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(histories.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(source.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(search.result.current.isSuccess).toBe(true));

    expect(api.getArchivedDocuments).toHaveBeenCalledWith('org1');
    expect(api.getDocumentById).toHaveBeenCalledWith('doc1');
    expect(api.getAllDocumentFiles).toHaveBeenCalledWith('org1');
    expect(api.getAllDocumentComments).toHaveBeenCalledWith('org1');
    expect(api.getOrgInvoices).toHaveBeenCalledWith('org1');
    expect(api.getDocumentFiles).toHaveBeenCalledWith('doc1');
    expect(api.getDocumentComments).toHaveBeenCalledWith('doc1');
    expect(api.getDocumentHistory).toHaveBeenCalledWith('doc1');
    expect(api.getSourceInvoiceInfo).toHaveBeenCalledWith(doc);
    expect(api.searchDocumentIdsByComment).toHaveBeenCalledWith('org1', 'query');
  });
});

describe('mutations', () => {
  it('invalidates document and archive caches after create', async () => {
    const input = { organizationId: 'org1', accountingObjectId: 'obj1', paymentDate: '2026-10-14', counterparty: 'ООО', responsibleId: 'u1' };
    api.createManualDocument.mockResolvedValue(document);
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateManualDocument('org1'), { wrapper: wrapper(queryClient) });

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.createManualDocument).toHaveBeenCalledWith(input);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['documents', 'org1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['documents-archive', 'org1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['document'] });
  });

  it('passes update payload and invalidates history', async () => {
    const updated = { ...document, counterparty: 'Новый' };
    api.updateDocumentWithHistory.mockResolvedValue(updated);
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateDocument('org1'), { wrapper: wrapper(queryClient) });

    result.current.mutate({ document, data: { counterparty: 'Новый' }, previousData: { counterparty: 'ООО' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.updateDocumentWithHistory).toHaveBeenCalledWith(document, { counterparty: 'Новый' }, 'document_updated', { counterparty: 'ООО' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['document-history', 'doc1'] });
  });

  it('uploads a file and invalidates file/history/document caches', async () => {
    const file = new File(['x'], 'scan.pdf');
    api.uploadDocumentFile.mockResolvedValue({ id: 'file1', document_id: 'doc1', organization_id: 'org1', file: 'scan.pdf', name: 'scan.pdf' } as IDocumentFile);
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUploadDocumentFile('org1'), { wrapper: wrapper(queryClient) });

    result.current.mutate({ document, file, displayName: 'Скан' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.uploadDocumentFile).toHaveBeenCalledWith(document, file, 'Скан');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['document-files', 'doc1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['document-history', 'doc1'] });
  });
});
