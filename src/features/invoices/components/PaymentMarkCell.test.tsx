import { describe, it, expect } from 'vitest';
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

const mark: IPaymentMark = {
  id: 'pm1', invoice_id: 'inv1', organization_id: 'org1',
  amount: 30000, comment: 'Частично', created_by: 'admin1', created: '2026-06-02',
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
  });

  it('shows mark details when mark exists', () => {
    renderWithProviders(
      <table><tbody><tr><td>
        <PaymentMarkCell
          invoice={invoice}
          mark={mark}
          canMarkPayment
          canViewPaymentMarks
        />
      </td></tr></tbody></table>,
    );

    expect(screen.getByText(/30 000/)).toBeInTheDocument();
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
});
