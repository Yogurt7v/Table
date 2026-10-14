import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { InvoiceTable } from './InvoiceTable';
import type { IInvoice } from '@/shared/types';

const { deleteInvoice } = vi.hoisted(() => ({ deleteInvoice: vi.fn() }));

vi.mock('@/api/collections', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  deleteInvoice,
}));

vi.mock('@/shared/hooks/useInvoicePermissions', () => ({
  useInvoicePermissions: () => ({
    role: 'admin',
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
    canEditField: () => true,
  }),
}));

vi.mock('@/shared/hooks/useOrganizationUsers', () => ({
  useOrganizationUsers: () => ({ data: [] }),
}));

vi.mock('@/shared/hooks/useUsers', () => ({
  useUsers: () => ({ data: [] }),
}));

vi.mock('@/shared/hooks/useCounterpartySearch', () => ({
  useCounterpartySearch: () => ({ results: [], isLoading: false }),
}));

function invoice(id: string): IInvoice {
  return {
    id,
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
}

function renderTable(invoices: IInvoice[]) {
  return renderWithProviders(
    <InvoiceTable
      orgId="org1"
      objectId="ao1"
      date="2026-06-01"
      invoices={invoices}
      highlightedIds={[]}
      isDraftOpen={false}
      onCancelDraft={() => {}}
      accountingObjects={[]}
      visibleColumns={['counterparty', 'actions']}
    />,
  );
}

function actionsButton(): HTMLElement {
  const [first] = screen.getAllByLabelText('Действия со счётом');
  if (!first) throw new Error('Кнопка действий не отрисована');
  return first;
}

async function openDeleteModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(actionsButton());
  await user.click(await screen.findByRole('menuitem', { name: 'Удалить' }));
  return screen.findByLabelText('Причина удаления');
}

beforeEach(() => {
  deleteInvoice.mockReset();
  deleteInvoice.mockResolvedValue(undefined);
});

describe('InvoiceTable — удаление счёта', () => {
  it('не даёт подтвердить удаление без причины и уходит в API с обрезанной причиной', async () => {
    const user = userEvent.setup();
    renderTable([invoice('inv1')]);

    await openDeleteModal(user);

    const confirmButton = screen.getByRole('button', { name: 'Удалить' });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText('Причина удаления'), '  счёт создан ошибочно  ');

    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    await waitFor(() => expect(deleteInvoice).toHaveBeenCalledWith('inv1', 'счёт создан ошибочно'));
  });

  it('очищает причину при каждом открытии окна', async () => {
    const user = userEvent.setup();
    renderTable([invoice('inv1')]);

    const input = await openDeleteModal(user);
    await user.type(input, 'первая попытка');
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    await waitFor(() =>
      expect(screen.queryByLabelText('Причина удаления')).not.toBeInTheDocument(),
    );

    await openDeleteModal(user);

    expect(screen.getByLabelText('Причина удаления')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeDisabled();
    expect(deleteInvoice).not.toHaveBeenCalled();
  });

  it('очищает причину после успешного удаления', async () => {
    const user = userEvent.setup();
    renderTable([invoice('inv1')]);

    const input = await openDeleteModal(user);
    await user.type(input, 'дубль');
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(deleteInvoice).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.queryByLabelText('Причина удаления')).not.toBeInTheDocument(),
    );

    await openDeleteModal(user);

    expect(screen.getByLabelText('Причина удаления')).toHaveValue('');
  });

  it('удаляет исходный счёт, а не строку копии с синтетическим id', async () => {
    const user = userEvent.setup();
    renderTable([invoice('abc123__p0')]);

    const input = await openDeleteModal(user);
    await user.type(input, 'частичная оплата');
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(deleteInvoice).toHaveBeenCalledWith('abc123', 'частичная оплата'));
  });
});
