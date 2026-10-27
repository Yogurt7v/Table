import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeletedDocumentsSection } from './DeletedDocumentsSection';
import type { IDocument } from '@/shared/types';

const { useArchivedDocuments, useRestoreDocument, useAccountingObjects } = vi.hoisted(() => ({
  useArchivedDocuments: vi.fn(),
  useRestoreDocument: vi.fn(),
  useAccountingObjects: vi.fn(),
}));

vi.mock('@/shared/hooks/useDocuments', () => ({
  useArchivedDocuments,
  useRestoreDocument,
}));

vi.mock('@/shared/hooks/useAccountingObjects', () => ({
  useAccountingObjects,
}));

vi.mock('@/api/client', () => ({
  pb: {
    collection: () => ({
      subscribe: vi.fn(() => Promise.resolve(() => {})),
      unsubscribe: vi.fn(),
    }),
  },
}));

function makeDocument(i: number): IDocument {
  return {
    id: `doc-${i}`,
    organization_id: 'org1',
    accounting_object_id: i % 2 === 0 ? 'obj1' : 'obj2',
    seq: i,
    payment_date: '2026-10-14',
    counterparty: `Контрагент ${i}`,
    purpose: 'Назначение',
    contract_no: '',
    invoice_no: String(i),
    amount: 100 + i,
    responsible_id: 'u1',
    responsible_name: 'Модератор',
    created_by: 'u1',
    created_by_name: 'Модератор',
    creation_mode: 'auto',
    sync_locked: false,
    provided: false,
    confirmed: false,
    payment_cancelled: false,
    is_deleted: true,
    deleted_by: 'u1',
    deleted_by_name: 'Админ',
    deleted_at: '2026-10-14T10:00:00.000Z',
    deletion_reason: `причина ${i}`,
  };
}

const documents = Array.from({ length: 5 }, (_, index) => makeDocument(index + 1));

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <DeletedDocumentsSection orgId="org1" />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('DeletedDocumentsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useArchivedDocuments.mockReturnValue({ data: documents, isLoading: false });
    useAccountingObjects.mockReturnValue({ data: [{ id: 'obj1', name: 'Объект 1' }, { id: 'obj2', name: 'Объект 2' }] });
    useRestoreDocument.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false });
  });

  it('renders archived documents with object names and reasons', async () => {
    renderSection();

    expect(await screen.findByText('Контрагент 1')).toBeInTheDocument();
    expect(screen.getAllByText('Объект 1').length).toBeGreaterThan(0);
    expect(screen.getByText('причина 1')).toBeInTheDocument();
  });

  it('filters by counterparty, reason or object name', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Контрагент 1');
    await user.type(screen.getByLabelText('Поиск в архиве документов'), 'причина 3');

    await waitFor(() => expect(screen.getByText('Контрагент 3')).toBeInTheDocument());
    expect(screen.queryByText('Контрагент 1')).not.toBeInTheDocument();
  });

  it('clears search with the X button', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Контрагент 1');
    await user.type(screen.getByLabelText('Поиск в архиве документов'), 'причина 3');
    await waitFor(() => expect(screen.getByText('Контрагент 3')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    await waitFor(() => expect(screen.getByText('Контрагент 1')).toBeInTheDocument());
  });

  it('opens restore confirmation and calls restore on confirm', async () => {
    const user = userEvent.setup();
    const restore = vi.fn().mockResolvedValue(undefined);
    useRestoreDocument.mockReturnValue({ mutateAsync: restore, isPending: false });
    renderSection();

    await screen.findByText('Контрагент 2');
    const restoreButtons = screen.getAllByRole('button', { name: 'Восстановить документ' });
    await user.click(restoreButtons[1]!);

    expect(await screen.findByText(/Восстановить документ №2/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Восстановить' }));

    await waitFor(() => expect(restore).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-2' })));
  });

  it('shows empty state when archive is empty', async () => {
    useArchivedDocuments.mockReturnValue({ data: [], isLoading: false });
    renderSection();

    expect(await screen.findByText('Архив документов пуст')).toBeInTheDocument();
  });
});
