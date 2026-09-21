import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeletedInvoicesSection } from './DeletedInvoicesSection';
import type { IDeletedInvoice } from '@/shared/types';

const { getDeletedInvoices, getAllDeletedInvoices, restoreDeletedInvoice,
  getDeletedInvoiceHistory, getDeletedInvoiceFiles, getDeletedInvoiceById, getUsers } = vi.hoisted(() => ({
  getDeletedInvoices: vi.fn(),
  getAllDeletedInvoices: vi.fn(),
  restoreDeletedInvoice: vi.fn(),
  getDeletedInvoiceHistory: vi.fn(),
  getDeletedInvoiceFiles: vi.fn(),
  getDeletedInvoiceById: vi.fn(),
  getUsers: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/api/collections', () => ({
  ARCHIVE_PAGE_SIZE: 25,
  getDeletedInvoices,
  getAllDeletedInvoices,
  restoreDeletedInvoice,
  getDeletedInvoiceHistory,
  getDeletedInvoiceFiles,
  getDeletedInvoiceById,
  getDeletedInvoiceFileUrl: () => '/mock-file.pdf',
  getUsers,
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
    original_id: `inv-${i}`,
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
    (_orgId: string, page: number, perPage: number) => {
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
  getAllDeletedInvoices.mockResolvedValue(archiveData);
}

function renderSection(props?: Partial<React.ComponentProps<typeof DeletedInvoicesSection>>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <DeletedInvoicesSection orgId="org1" {...props} />
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

  it('поиск по кнопке работает по всей базе, регистронезависим и без пагинации', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Контрагент 1');

    await user.type(screen.getByLabelText('Поиск в архиве'), 'контрагент 1');
    await user.click(screen.getByRole('button', { name: 'Найти' }));

    await waitFor(() => {
      expect(screen.getByText('Контрагент 19')).toBeInTheDocument();
    });
    expect(screen.getByText('Контрагент 1')).toBeInTheDocument();
    expect(screen.queryByText('Контрагент 20')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    expect(getAllDeletedInvoices).toHaveBeenCalledWith('org1');
  });

  it('показывает "Ничего не найдено" при пустом результате поиска', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Контрагент 1');

    await user.type(screen.getByLabelText('Поиск в архиве'), 'несуществующий');
    await user.click(screen.getByRole('button', { name: 'Найти' }));

    await waitFor(() => {
      expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });

  it('кнопка "X" стирает поисковый запрос и возвращает к пагинации', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Контрагент 1');

    const input = screen.getByLabelText('Поиск в архиве');
    await user.type(input, 'Контрагент 1');
    await user.click(screen.getByRole('button', { name: 'Найти' }));
    await waitFor(() => {
      expect(screen.getByText('Контрагент 19')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Очистить поиск' }));

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
    await waitFor(() => {
      expect(screen.getByText('Контрагент 20')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(getDeletedInvoices).toHaveBeenLastCalledWith('org1', 1, 25);
  });

  it('открывает модалку удалённого счёта по highlightInvoiceId', async () => {
    const target = makeArchiveItem(1);
    getDeletedInvoiceById.mockResolvedValue(target);
    const onConsumed = vi.fn();

    renderSection({ highlightInvoiceId: 'del-1', onHighlightConsumed: onConsumed });

    await waitFor(() => {
      expect(getDeletedInvoiceById).toHaveBeenCalledWith('del-1');
    });
    expect(await screen.findByText(/Контрагент 1 · 101/)).toBeInTheDocument();
    await waitFor(() => {
      expect(onConsumed).toHaveBeenCalled();
    });
  });

  it('выделяет строку удалённого счёта в текущем списке', async () => {
    renderSection({ highlightInvoiceId: 'del-2' });

    await screen.findByText('Контрагент 2');

    const row = screen.getByText('Контрагент 2').closest('tr');
    expect(row).toHaveAttribute('data-highlighted', 'true');
  });
});