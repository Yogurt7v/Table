import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { GroupedInvoiceTable } from './GroupedInvoiceTable';
import type { IInvoice, IInvoiceFile } from '@/shared/types';

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

const file: IInvoiceFile = {
  id: 'f1',
  invoice_id: 'inv1',
  organization_id: 'org1',
  file: 'f1/schet.pdf',
  name: 'schet.pdf',
};

const permissions = {
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  canViewHistory: true,
  canMove: true,
  canPay: true,
  canMarkPayment: true,
  canRemoveApprovalMark: true,
  canViewPaymentMarks: true,
  canViewPaidDate: true,
  canManageFiles: true,
};

function renderTable(props?: Partial<Parameters<typeof GroupedInvoiceTable>[0]>) {
  return renderWithProviders(
    <GroupedInvoiceTable
      orgId="org1"
      invoices={[invoice]}
      isDraftOpen={false}
      highlightedIds={[]}
      permissions={permissions}
      visibleColumns={['counterparty', 'purpose', 'amount', 'paid', 'files']}
      onEdit={() => {}}
      onDelete={() => {}}
      onHistory={() => {}}
      onMove={() => {}}
      onPayInvoice={() => {}}
      onClearPayment={() => {}}
      {...props}
    />,
  );
}

describe('GroupedInvoiceTable', () => {
  it('renders file links for invoices with files without crashing', () => {
    renderTable({ filesByInvoice: { inv1: [file] } });

    expect(screen.getAllByText('schet.pdf').length).toBeGreaterThan(0);
  });

  it('renders empty state when there are no invoices and no draft', () => {
    renderTable({ invoices: [] });

    expect(screen.getByText('Нет счетов на эту дату')).toBeInTheDocument();
  });

  describe('удаление счёта на мобильных карточках', () => {
    it('показывает кнопку удаления, когда canDelete = true', () => {
      renderTable({ onDelete: vi.fn() });

      expect(screen.getByLabelText('Удалить счёт')).toBeInTheDocument();
    });

    it('скрывает кнопку удаления, когда canDelete = false', () => {
      renderTable({ onDelete: vi.fn(), permissions: { ...permissions, canDelete: false } });

      expect(screen.queryByLabelText('Удалить счёт')).not.toBeInTheDocument();
    });

    it('вызывает onDelete со счётом карточки', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      renderTable({ onDelete });

      await user.click(screen.getByLabelText('Удалить счёт'));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(invoice);
    });
  });
});
