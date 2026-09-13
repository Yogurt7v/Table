import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeletedInvoicesSection } from './DeletedInvoicesSection';
import type { IDeletedInvoice } from '@/shared/types';

const { getDeletedInvoices, searchDeletedInvoices, restoreDeletedInvoice,
  getDeletedInvoiceHistory, getDeletedInvoiceFiles } = vi.hoisted(() => ({
  getDeletedInvoices: vi.fn(),
  searchDeletedInvoices: vi.fn(),
  restoreDeletedInvoice: vi.fn(),
  getDeletedInvoiceHistory: vi.fn(),
  getDeletedInvoiceFiles: vi.fn(),
}));

vi.mock('@/api/collections', () => ({
  ARCHIVE_PAGE_SIZE: 25,
  getDeletedInvoices,
  searchDeletedInvoices,
  restoreDeletedInvoice,
  getDeletedInvoiceHistory,
  getDeletedInvoiceFiles,
  getDeletedInvoiceFileUrl: () => '/mock-file.pdf',
}));

vi.mock('@/api/client', () => ({
  pb: {
    collection: () => ({
      subscribe: vi.fn(() => Promise.resolve(() => {})),
      unsubscribe: vi.fn(),
    }),
  },
}));

vi.mock('@/shared/hooks/useCurrentUserRole', () => ({
  useCurrentUserRole: () => 'admin',
}));

function makeArchiveItem(i: number): IDeletedInvoice {
  return {
    id: `del-${i}`,
    organization_id: 'org1',
    accounting_object_id: '',
    date: '',
    seq: i,
    counterparty: `Контрагент ${i}`,
    purpose: 'Назначение',
    contract_no: '',
    invoice_no: String(i),
    amount: 100 + i,
    paid: false,
    paid_date: '',
    paid_amount: null,
    payment_amounts: [],
    comment: '',
    copy_comments: {},
    created_by: '',
    updated_by: '',
    original_invoice_id: '',
    source_paid_amount: 0,
    source_paid_date: '',
    source_created: '',
    deleted_by: '',
    deleted_by_name: 'Админ',
    deleted_at: `2024-01-${String((i % 28) + 1).padStart(2, '0')} 10:00:00`,
    created: '',
  };
}

const archiveData = Array.from({ length: 60 }, (_, idx) => makeArchiveItem(idx + 1));

function setupMocks() {
  getDeletedInvoices.mockImplementation(
    (orgId: string, page: number, perPage: number) => {
      const start = (page - 1) * perPage;
      return Promise.resolve({
        items: archiveData.slice(start, start + perPage),
        page,
        perPage,
        totalItems: archiveData.length,
        totalPages: Math.ceil(archiveData.length / perPage),
      });
    },
  );
  searchDeletedInvoices.mockImplementation(
    (orgId: string, query: string, page: number, perPage: number) => {
      const filtered = archiveData.filter((inv) =>
        inv.counterparty.toLowerCase().includes(query.toLowerCase()),
      );
      const start = (page - 1) * perPage;
      return Promise.resolve({
        items: filtered.slice(start, start + perPage),
        page,
        perPage,
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / perPage),
      });
    },
  );
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <DeletedInvoicesSection orgId="org1" />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('DeletedInvoicesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('рендерит первую страницу и показывает пагинацию', async () => {
    renderSection();

    expect(await screen.findByText('Контрагент 1')).toBeInTheDocument();
    expect(screen.getByText('Контрагент 25')).toBeInTheDocument();
    expect(screen.queryByText('Контрагент 26')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('переключается на вторую страницу по клику', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Контрагент 1');

    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(screen.getByText('Контрагент 26')).toBeInTheDocument();
    });
    expect(screen.getByText('Контрагент 50')).toBeInTheDocument();
    expect(screen.queryByText('Контрагент 1')).not.toBeInTheDocument();
    expect(getDeletedInvoices).toHaveBeenCalledWith('org1', 2, 25);
  });

  it('поиск работает по всей базе и сбрасывает страницу на первую', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Контрагент 1');

    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => {
      expect(screen.getByText('Контрагент 26')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Поиск в архиве'), 'Контрагент 1');

    await waitFor(
      () => {
        expect(screen.getByText('Контрагент 19')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(screen.queryByText('Контрагент 20')).not.toBeInTheDocument();
    expect(searchDeletedInvoices).toHaveBeenCalledWith('org1', 'Контрагент 1', 1, 25);
  });

  it('показывает "Ничего не найдено" при пустом результате поиска', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Контрагент 1');

    await user.type(screen.getByLabelText('Поиск в архиве'), 'несуществующий');

    await waitFor(
      () => {
        expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument();
  });

  it('кнопка "X" стирает поисковый запрос', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Контрагент 1');

    const input = screen.getByLabelText('Поиск в архиве');
    await user.type(input, 'Контрагент 1');
    await waitFor(
      () => {
        expect(screen.getByText('Контрагент 19')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    await user.click(screen.getByRole('button', { name: 'Очистить поиск' }));

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
    await waitFor(
      () => {
        expect(screen.getByText('Контрагент 20')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(getDeletedInvoices).toHaveBeenLastCalledWith('org1', 1, 25);
  });
});