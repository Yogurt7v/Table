import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/mocks/test-utils';
import { PaymentMarkCell } from './PaymentMarkCell';
import type { IInvoice, IPaymentMark } from '@/shared/types';

const invoice: IInvoice = {
  id: 'inv1', organization_id: 'org1', accounting_object_id: 'ao1',
  date: '2026-06-01', seq: 1, counterparty: 'ООО "Тест"',
  purpose: 'Оплата', contract_no: '', invoice_no: 'СФ-001',
  amount: 50000, paid: false, paid_amount: null, payment_amounts: [],
  paid_date: '', comment: '', created_by: 'admin1', updated_by: 'admin1',
};

const partialMark: IPaymentMark = {
  id: 'pm1', invoice_id: 'inv1', organization_id: 'org1',
  amount: 30000, comment: 'Частично', status: 'partial', created_by: 'admin1', created: '2026-06-02',
};

const paidMark: IPaymentMark = {
  id: 'pm3', invoice_id: 'inv1', organization_id: 'org1',
  amount: 50000, comment: '', status: 'approved', created_by: 'admin1', created: '2026-06-02',
};

const approvalMark: IPaymentMark = {
  id: 'pm2', invoice_id: 'inv1', organization_id: 'org1',
  amount: 50000, comment: '', status: 'proposed', created_by: 'boss1', created: '2026-06-02',
};

describe('PaymentMarkCell', () => {
  it('shows pay buttons when canMarkPayment and no mark exists', () => {
    renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={undefined}
          canMarkPayment
          canViewPaymentMarks
          onMarkForPayment={() => {}}
        />
      </td></tr></tbody></table>,
    );

    expect(screen.getByText('Оплатить')).toBeInTheDocument();
    expect(screen.getByText('Частично')).toBeInTheDocument();
    expect(screen.getByText('Согласование')).toBeInTheDocument();
  });

  it('shows partial mark with its own label', () => {
    renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={partialMark}
          canMarkPayment
          canViewPaymentMarks
        />
      </td></tr></tbody></table>,
    );

    expect(screen.getByText(/Частично: 30 000/)).toBeInTheDocument();
  });

  it('shows paid mark with its own label', () => {
    renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={paidMark}
          canMarkPayment
          canViewPaymentMarks
        />
      </td></tr></tbody></table>,
    );

    expect(screen.getByText(/Оплатить: 50 000/)).toBeInTheDocument();
  });

  it('shows approval mark with its own label', () => {
    renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={approvalMark}
          canMarkPayment
          canViewPaymentMarks
        />
      </td></tr></tbody></table>,
    );

    expect(screen.getByText(/Согласование: 50 000/)).toBeInTheDocument();
  });

  it('shows status labels in view-only mode (moderator)', () => {
    renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={paidMark}
          canMarkPayment={false}
          canViewPaymentMarks
        />
      </td></tr></tbody></table>,
    );

    expect(screen.getByText(/Оплатить: 50 000/)).toBeInTheDocument();
  });

  it('shows dash when cannot view payment marks', () => {
    renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={undefined}
          canMarkPayment={false}
          canViewPaymentMarks={false}
        />
      </td></tr></tbody></table>,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows approve button for approval mark in view-only mode', () => {
    const onApproveMark = vi.fn();
    renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={approvalMark}
          canMarkPayment={false}
          canViewPaymentMarks
          onApproveMark={onApproveMark}
        />
      </td></tr></tbody></table>,
    );

    const approveButton = screen.getByLabelText('Отметить к оплате');
    expect(approveButton).toBeInTheDocument();
    approveButton.click();
    expect(onApproveMark).toHaveBeenCalledWith('pm2');
  });

  it('shows approve button for approval mark in boss mode', () => {
    renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={approvalMark}
          canMarkPayment
          canViewPaymentMarks
          onApproveMark={() => {}}
        />
      </td></tr></tbody></table>,
    );

    expect(screen.getByLabelText('Отметить к оплате')).toBeInTheDocument();
  });

  it('hides approve button for paid and partial marks', () => {
    const { rerender } = renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={paidMark}
          canMarkPayment
          canViewPaymentMarks
          onApproveMark={() => {}}
        />
      </td></tr></tbody></table>,
    );

    expect(screen.queryByLabelText('Отметить к оплате')).not.toBeInTheDocument();

    rerender(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={partialMark}
          canMarkPayment
          canViewPaymentMarks
          onApproveMark={() => {}}
        />
      </td></tr></tbody></table>,
    );

    expect(screen.queryByLabelText('Отметить к оплате')).not.toBeInTheDocument();
  });

  it('hides approve button when handler is not provided', () => {
    renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={approvalMark}
          canMarkPayment={false}
          canViewPaymentMarks
        />
      </td></tr></tbody></table>,
    );

    expect(screen.queryByLabelText('Отметить к оплате')).not.toBeInTheDocument();
  });
});