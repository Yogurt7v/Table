import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/mocks/test-utils';
import { InvoiceMobileCardView } from './InvoiceMobileCardView';
import type { IInvoice } from '@/shared/types';

const invoice: IInvoice = {
  id: 'inv1',
  organization_id: 'org1',
  accounting_object_id: 'ao1',
  date: '2026-06-01',
  seq: 1,
  counterparty: 'ООО "Тест"',
  purpose: 'Оплата работ',
  contract_no: 'Д-1',
  invoice_no: 'СФ-001',
  amount: 50000,
  paid: false,
  paid_amount: null,
  payment_amounts: [],
  paid_date: '',
  comment: '',
  created_by: 'admin1',
  updated_by: 'admin1',
  copy_comments: {},
  source_paid_amount: 0,
  source_paid_date: '',
};

// Та же фикстура прав, что и в GroupedInvoiceTable.test.tsx, без canPay —
// мобильная карточка его не использует.
const permissions = {
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  canViewHistory: true,
  canMove: true,
  canMarkPayment: true,
  canRemoveApprovalMark: true,
  canViewPaymentMarks: true,
  canViewPaidDate: true,
  canManageFiles: true,
};

function renderCard(props?: Partial<Parameters<typeof InvoiceMobileCardView>[0]>) {
  return renderWithProviders(
    <InvoiceMobileCardView
      invoices={[invoice]}
      marksByInvoice={{}}
      highlightedIds={[]}
      permissions={permissions}
      isDraftOpen={false}
      onClearPaymentConfirm={() => {}}
      onOpenPartialModal={() => {}}
      {...props}
    />,
  );
}

describe('InvoiceMobileCardView', () => {
  it('не показывает кнопку удаления, если обработчик onDelete не передан', () => {
    renderCard();

    expect(screen.queryByLabelText('Удалить счёт')).not.toBeInTheDocument();
  });

  it('показывает кнопку удаления при canDelete = true и заданном onDelete', () => {
    renderCard({ onDelete: vi.fn() });

    expect(screen.getByLabelText('Удалить счёт')).toBeInTheDocument();
  });
});
