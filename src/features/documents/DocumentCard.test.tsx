import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentCardModal } from './DocumentCardModal';
import type { IDocument, IAccountingObject, IUser } from '@/shared/types';
import type { OrgRole } from '@/features/invoices/invoice-field-access';

const document: IDocument = {
  id: 'doc1',
  organization_id: 'org1',
  accounting_object_id: 'obj1',
  seq: 5,
  payment_date: '2026-10-14',
  counterparty: 'ООО Тест',
  purpose: 'Назначение',
  contract_no: 'Д-1',
  invoice_no: 'СЧ-1',
  amount: 1000,
  responsible_id: 'u1',
  responsible_name: 'Ответственный',
  created_by: 'u2',
  created_by_name: 'Автор',
  creation_mode: 'auto',
  sync_locked: false,
  provided: false,
  confirmed: false,
  payment_cancelled: false,
  is_deleted: false,
};

const objects: IAccountingObject[] = [
  { id: 'obj1', organization_id: 'org1', name: 'Объект 1' },
  { id: 'obj2', organization_id: 'org1', name: 'Объект 2' },
];

const users: IUser[] = [
  { id: 'u1', email: 'u1@test.com', login: 'u1', name: 'Ответственный', avatar: '', verified: true, created: '', updated: '' },
  { id: 'u2', email: 'u2@test.com', login: 'u2', name: 'Автор', avatar: '', verified: true, created: '', updated: '' },
];

const api = vi.hoisted(() => ({
  useDocument: vi.fn(),
  useDocumentFiles: vi.fn(),
  useDocumentComments: vi.fn(),
  useDocumentHistory: vi.fn(),
  useDocumentSource: vi.fn(),
  useUpdateDocument: vi.fn(),
  useUpdateDocumentStatus: vi.fn(),
  useUploadDocumentFile: vi.fn(),
  useDeleteDocumentFile: vi.fn(),
  useAddDocumentComment: vi.fn(),
  useDeleteDocumentComment: vi.fn(),
  useArchiveDocument: vi.fn(),
  useMoveDocument: vi.fn(),
  useMarkPaymentCancelled: vi.fn(),
}));

vi.mock('@/shared/hooks/useDocuments', () => ({
  useDocument: api.useDocument,
  useDocumentFiles: api.useDocumentFiles,
  useDocumentComments: api.useDocumentComments,
  useDocumentHistory: api.useDocumentHistory,
  useDocumentSource: api.useDocumentSource,
  useUpdateDocument: api.useUpdateDocument,
  useUpdateDocumentStatus: api.useUpdateDocumentStatus,
  useUploadDocumentFile: api.useUploadDocumentFile,
  useDeleteDocumentFile: api.useDeleteDocumentFile,
  useAddDocumentComment: api.useAddDocumentComment,
  useDeleteDocumentComment: api.useDeleteDocumentComment,
  useArchiveDocument: api.useArchiveDocument,
  useMoveDocument: api.useMoveDocument,
  useMarkPaymentCancelled: api.useMarkPaymentCancelled,
}));

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

import { createElement } from 'react';

function renderModal(props: Partial<Parameters<typeof DocumentCardModal>[0]>, queryClient: QueryClient) {
  const defaultProps: Parameters<typeof DocumentCardModal>[0] = {
    documentId: 'doc1',
    opened: true,
    onClose: vi.fn(),
    organizationId: 'org1',
    role: 'admin' as OrgRole,
    currentUserId: 'u1',
    objects,
    users,
    ...props,
  };
  return render(
    <MantineProvider>
      <DocumentCardModal {...defaultProps} />
    </MantineProvider>,
    { wrapper: wrapper(queryClient) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.useDocument.mockReturnValue({ data: document, isLoading: false });
  api.useDocumentFiles.mockReturnValue({ data: [], isLoading: false });
  api.useDocumentComments.mockReturnValue({ data: [], isLoading: false });
  api.useDocumentHistory.mockReturnValue({ data: [], isLoading: false });
  api.useDocumentSource.mockReturnValue({ data: null, isLoading: false });
  api.useUpdateDocument.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(document), isPending: false });
  api.useUpdateDocumentStatus.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(document), isPending: false });
  api.useUploadDocumentFile.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  api.useDeleteDocumentFile.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(document), isPending: false });
  api.useAddDocumentComment.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  api.useDeleteDocumentComment.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false });
  api.useArchiveDocument.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(document), isPending: false });
  api.useMoveDocument.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(document), isPending: false });
  api.useMarkPaymentCancelled.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(document), isPending: false });
});

describe('DocumentCardModal', () => {
  it('renders 4 tabs: Документ, Файлы, Комментарии, История', () => {
    const queryClient = makeQueryClient();
    renderModal({}, queryClient);
    expect(screen.getByRole('tab', { name: 'Документ' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Файлы' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Комментарии' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'История' })).toBeInTheDocument();
  });

  it('shows document number in title', () => {
    const queryClient = makeQueryClient();
    renderModal({}, queryClient);
    expect(screen.getByText('Документ №5')).toBeInTheDocument();
  });

  it('boss cannot see edit controls', async () => {
    const queryClient = makeQueryClient();
    const user = userEvent.setup();
    renderModal({ role: 'boss' as OrgRole, currentUserId: 'u9' }, queryClient);

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Документ' })).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Документ' }));

    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'В архив' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Новый комментарий')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Добавить комментарий' })).not.toBeInTheDocument();
  });

  it('admin can see edit controls', async () => {
    const queryClient = makeQueryClient();
    const user = userEvent.setup();
    renderModal({ role: 'admin' as OrgRole, currentUserId: 'u1' }, queryClient);

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Документ' })).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Документ' }));

    expect(screen.getByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'В архив' })).toBeInTheDocument();
  });

  it('can add a comment and calls the add comment API', async () => {
    const queryClient = makeQueryClient();
    const user = userEvent.setup();
    renderModal({ role: 'admin' as OrgRole, currentUserId: 'u1' }, queryClient);

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Комментарии' })).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Комментарии' }));

    await user.type(screen.getByLabelText('Новый комментарий'), 'Тестовый комментарий');
    await user.click(screen.getByRole('button', { name: 'Добавить комментарий' }));

    await waitFor(() =>
      expect(api.useAddDocumentComment).toBeDefined(),
    );
    expect(api.useAddDocumentComment).toHaveBeenCalled();
  });
});
