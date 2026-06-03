import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { PayModal } from './PayModal';
import type { IInvoice } from '@/shared/types';

const invoice: IInvoice = {
  id: 'inv1', organization_id: 'org1', accounting_object_id: 'ao1',
  date: '2026-06-01', seq: 1, counterparty: 'ООО "Тест"',
  purpose: 'Оплата услуг', contract_no: 'Д-001', invoice_no: 'СФ-001',
  amount: 50000, paid: false, paid_amount: null, payment_amounts: [],
  paid_date: '', comment: '', created_by: 'admin1', updated_by: 'admin1',
};

describe('PayModal', () => {
  it('renders invoice details', () => {
    renderWithProviders(
      <PayModal
        opened
        onClose={() => {}}
        invoice={invoice}
        amount=""
        onAmountChange={() => {}}
        onPay={() => {}}
      />,
    );

    expect(screen.getByText('Оплата счёта')).toBeInTheDocument();
    expect(screen.getByText('ООО "Тест"')).toBeInTheDocument();
    expect(screen.getByText('Оплата услуг')).toBeInTheDocument();
    expect(screen.getByText('50 000,00 ₽')).toBeInTheDocument();
  });

  it('calls onPay with amount', async () => {
    const user = userEvent.setup();
    const onPay = vi.fn();
    let amount = '25000';

    renderWithProviders(
      <PayModal
        opened
        onClose={() => {}}
        invoice={invoice}
        amount={amount}
        onAmountChange={(v) => { amount = v; }}
        onPay={onPay}
      />,
    );

    await user.type(screen.getByLabelText('Сумма к оплате'), '25000');
    await user.click(screen.getByRole('button', { name: 'Оплатить' }));
  });
});
