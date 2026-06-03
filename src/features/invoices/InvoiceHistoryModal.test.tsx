import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/mocks/test-utils';
import { InvoiceHistoryModal } from './InvoiceHistoryModal';
import type { IInvoiceHistory } from '@/shared/types';

vi.mock('@/api/collections', () => ({
  getInvoiceHistory: vi.fn(),
}));

import { getInvoiceHistory } from '@/api/collections';

const mockEntry: IInvoiceHistory = {
  id: 'h1',
  invoice_id: 'inv1',
  author: 'Админ',
  changed_at: '2026-06-02T10:00:00Z',
  previous_data: { amount: 40000 },
};

describe('InvoiceHistoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInvoiceHistory).mockResolvedValue([]);
  });

  it('shows loading state when opened', () => {
    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(/история/i)).toBeInTheDocument();
  });

  it('shows empty state when no history', async () => {
    vi.mocked(getInvoiceHistory).mockResolvedValue([]);

    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Изменений пока нет')).toBeInTheDocument();
    });
  });

  it('fetches and displays history entries', async () => {
    vi.mocked(getInvoiceHistory).mockResolvedValue([mockEntry]);

    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Админ')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('40 000,00 ₽')).toBeInTheDocument();
    });
  });
});
