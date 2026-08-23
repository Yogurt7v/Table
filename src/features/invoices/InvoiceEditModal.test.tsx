import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { InvoiceEditModal } from './InvoiceEditModal';
import type { IInvoice } from '@/shared/types';

const mockInvoice: IInvoice = {
  id: 'inv1', organization_id: 'org1', accounting_object_id: 'ao1',
  date: '2026-06-01', seq: 1, counterparty: 'ООО "Тест"',
  purpose: 'Оплата услуг', contract_no: 'Д-001', invoice_no: 'СФ-001',
  amount: 50000, paid: false, paid_amount: null, payment_amounts: [],
  paid_date: '', comment: 'Комментарий', created_by: 'admin1', updated_by: 'admin1',
};

describe('InvoiceEditModal', () => {
  it('renders create mode with empty form', () => {
    renderWithProviders(
      <InvoiceEditModal opened onClose={() => {}} onSave={() => {}} />,
    );

    expect(screen.getByText('Добавление нового счёта')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Введите имя контрагента')).toBeInTheDocument();
  });

  it('renders edit mode with invoice data', () => {
    renderWithProviders(
      <InvoiceEditModal opened invoice={mockInvoice} onClose={() => {}} onSave={() => {}} />,
    );

    expect(screen.getByText('Редактирование счёта')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ООО "Тест"')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Оплата услуг')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Д-001')).toBeInTheDocument();
  });

  it('shows validation error when saving empty form', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    renderWithProviders(
      <InvoiceEditModal opened onClose={() => {}} onSave={onSave} />,
    );

    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(screen.getByText('Укажите контрагента')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with form data when valid', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    renderWithProviders(
      <InvoiceEditModal opened onClose={() => {}} onSave={onSave} />,
    );

    await user.type(screen.getByPlaceholderText('Введите имя контрагента'), 'Новый контрагент');
    await user.type(screen.getByPlaceholderText('Введите назначение платежа'), 'Оплата');
    await user.type(screen.getByPlaceholderText('Введите номер счёта'), 'СФ-100');
    await user.type(screen.getByPlaceholderText('0'), '25000');

    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  it('asks for confirmation before discarding unsaved changes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(
      <InvoiceEditModal opened onClose={onClose} onSave={() => {}} />,
    );

    await user.type(screen.getByPlaceholderText('Введите имя контрагента'), 'ООО Черновик');

    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(await screen.findByText('Закрыть без сохранения? Введённые данные будут потеряны.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Закрыть без сохранения' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes immediately when form is pristine', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(
      <InvoiceEditModal opened invoice={mockInvoice} onClose={onClose} onSave={() => {}} />,
    );

    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Закрыть без сохранения? Введённые данные будут потеряны.')).not.toBeInTheDocument();
  });
});
