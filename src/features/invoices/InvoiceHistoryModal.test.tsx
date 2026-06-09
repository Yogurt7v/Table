import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/mocks/test-utils';
import { InvoiceHistoryModal } from './InvoiceHistoryModal';
import type { IInvoiceHistory, IInvoice } from '@/shared/types';

vi.mock('@/api/collections', () => ({
  getInvoiceHistory: vi.fn(),
  getInvoice: vi.fn(),
}));

import { getInvoiceHistory, getInvoice } from '@/api/collections';

const mockInvoice: IInvoice = {
  id: 'inv1',
  organization_id: 'org1',
  accounting_object_id: 'ao1',
  date: '2026-06-01',
  seq: 1,
  counterparty: 'ООО "Контрагент А"',
  purpose: 'Оплата услуг',
  contract_no: 'Д-001',
  invoice_no: 'СФ-001',
  amount: 50000,
  paid: false,
  paid_amount: null,
  payment_amounts: [],
  paid_date: '',
  comment: '',
  created_by: 'admin1',
  updated_by: 'admin1',
};

const mockEntry: IInvoiceHistory = {
  id: 'h1',
  invoice_id: 'inv1',
  author: 'Админ',
  changed_at: '2026-06-02T10:00:00Z',
  previous_data: { amount: 40000 },
};

const mockPaymentEntry: IInvoiceHistory = {
  id: 'h2',
  invoice_id: 'inv1',
  author: 'Админ',
  changed_at: '2026-06-02T10:00:00Z',
  previous_data: {
    paid: false,
    paid_date: '2026-06-01',
    payment_amounts: [10000],
    paid_amount: 10000,
  },
};

describe('InvoiceHistoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInvoiceHistory).mockResolvedValue([]);
    vi.mocked(getInvoice).mockResolvedValue(mockInvoice);
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

  it('fetches and displays history entries with from → to', async () => {
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
      expect(screen.getByText(/40[\s\u00a0]000,00 ₽/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/50[\s\u00a0]000,00 ₽/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Старые значения зачёркнуты/)).toBeInTheDocument();
    });
  });

  it('hides payment_amounts and paid_amount from display', async () => {
    vi.mocked(getInvoiceHistory).mockResolvedValue([mockPaymentEntry]);

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

    expect(screen.queryByText(/payment_amounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/paid_amount/i)).not.toBeInTheDocument();
  });

  it('shows payment from → to when paid changes', async () => {
    const paidEntry: IInvoiceHistory = {
      id: 'h3',
      invoice_id: 'inv1',
      author: 'Админ',
      changed_at: '2026-06-02T10:00:00Z',
      previous_data: {
        paid: false,
        paid_date: '2026-06-01',
        payment_amounts: [5000],
      },
    };
    vi.mocked(getInvoiceHistory).mockResolvedValue([paidEntry]);
    vi.mocked(getInvoice).mockResolvedValue({ ...mockInvoice, paid: true, paid_date: '2026-06-01', payment_amounts: [5000] });

    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Не оплачено/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Оплачено/)).toBeInTheDocument();
    });
  });

  it('applies line-through to old values', async () => {
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
      const struck = screen.getByText(/40[\s\u00a0]000,00 ₽/);
      expect(struck.closest('[class*="mantine-Text-root"]')).toHaveStyle({ textDecoration: 'line-through' });
    });
  });

  it('shows old header text', async () => {
    vi.mocked(getInvoiceHistory).mockResolvedValue([mockEntry]);
    vi.mocked(getInvoice).mockResolvedValue(mockInvoice);

    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/зачёркнуты/)).toBeInTheDocument();
    });
  });
});
