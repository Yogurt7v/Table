import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/mocks/test-utils';
import { InvoiceHistoryModal } from './InvoiceHistoryModal';
import type { IInvoiceHistory, IInvoice } from '@/shared/types';

vi.mock('@/api/collections', () => ({
  getInvoiceHistoryChain: vi.fn(),
}));

import { getInvoiceHistoryChain } from '@/api/collections';

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
  source_paid_amount: 0,
  source_paid_date: '',
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
    payment: 10000,
  },
};

function mockChain(history: IInvoiceHistory[], invoice: IInvoice = mockInvoice) {
  return [{ invoice, history }];
}

describe('InvoiceHistoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(mockChain([]));
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
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(mockChain([]));

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
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(mockChain([mockEntry]));

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
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(mockChain([mockPaymentEntry]));

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
        paid_amount: 5000,
        payment: 5000,
      },
    };
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(
      mockChain([paidEntry], { ...mockInvoice, paid: true, paid_date: '2026-06-01', payment_amounts: [5000], paid_amount: 5000 }),
    );

    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Оплачено 5[\s\u00a0]000,00 ₽ · 01\.06\.2026 · остаток 40[\s\u00a0]000,00 ₽/),
      ).toBeInTheDocument();
    });
  });

  it('shows the actual payment amount even when the invoice was not paid before', async () => {
    const firstPayment: IInvoiceHistory = {
      id: 'h7',
      invoice_id: 'inv1',
      author: 'Админ',
      changed_at: '2026-09-09T15:18:00Z',
      previous_data: {
        paid: false,
        paid_amount: null,
        payment_amounts: [],
        paid_date: '',
        payment: 400,
        remaining: 3000,
      },
    };
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(
      mockChain([firstPayment], {
        ...mockInvoice,
        amount: 3400,
        paid: true,
        paid_date: '2026-09-09',
        payment_amounts: [400],
        paid_amount: 400,
      }),
    );

    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Оплачено 400,00 ₽ · остаток 3[\s\u00a0]000,00 ₽/),
      ).toBeInTheDocument();
    });
  });

  it('applies line-through to old values', async () => {
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(mockChain([mockEntry]));

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
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(mockChain([mockEntry]));

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

  it('shows mark created event', async () => {
    const markEntry: IInvoiceHistory = {
      id: 'h4',
      invoice_id: 'inv1',
      author: 'Босс',
      changed_at: '2026-06-02T10:00:00Z',
      type: 'mark_created',
      previous_data: { status: 'approved', amount: 50000, comment: 'Срочно' },
    };
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(mockChain([markEntry]));

    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Босс')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Оплатить/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/50[\s\u00a0]000,00 ₽/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Срочно/)).toBeInTheDocument();
  });

  it('shows mark deleted event', async () => {
    const markEntry: IInvoiceHistory = {
      id: 'h5',
      invoice_id: 'inv1',
      author: 'Босс',
      changed_at: '2026-06-02T11:00:00Z',
      type: 'mark_deleted',
      previous_data: { status: 'proposed', amount: 50000, comment: '' },
    };
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(mockChain([markEntry]));

    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Согласование/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Отменена отметка «Согласование 50[\s\u00a0]000,00 ₽»/)).toBeInTheDocument();
    });
  });

  it('shows error state when loading fails', async () => {
    vi.mocked(getInvoiceHistoryChain).mockRejectedValue(new Error('401 Unauthorized'));

    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/не удалось загрузить историю/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/401 Unauthorized/)).toBeInTheDocument();
    });
  });

  it('shows copy created event', async () => {
    const copyEntry: IInvoiceHistory = {
      id: 'h6',
      invoice_id: 'inv1',
      author: 'Админ',
      changed_at: '2026-06-02T12:00:00Z',
      type: 'copy_created',
      previous_data: { amount: 30000, source_paid_amount: 20000, original_invoice_id: 'src1' },
    };
    vi.mocked(getInvoiceHistoryChain).mockResolvedValue(
      mockChain([copyEntry], { ...mockInvoice, original_invoice_id: 'src1' }),
    );

    renderWithProviders(
      <InvoiceHistoryModal
        opened
        invoiceId="inv1"
        invoiceLabel="Счёт №1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Создана копия/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/остаток 30[\s\u00a0]000,00 ₽/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/из частичной оплаты 20[\s\u00a0]000,00 ₽/)).toBeInTheDocument();
    });
  });
});
