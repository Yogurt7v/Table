import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { SearchResultsView } from './SearchResultsView';
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
  paid_date: '2026-06-02',
  comment: '',
  created_by: 'admin1',
  updated_by: 'admin1',
  copy_comments: {},
  source_paid_amount: 0,
  source_paid_date: '',
};

const longPurpose =
  'Оплата работ по договору подряда за выполнение строительно-монтажных работ на объекте в третьем квартале текущего года';

function renderView(props?: Partial<Parameters<typeof SearchResultsView>[0]>) {
  return renderWithProviders(
    <SearchResultsView
      searchText="ООО"
      searchResults={[invoice]}
      date="2026-06-01"
      canViewPaidDate
      onBackToDate={() => {}}
      onOpenInvoice={() => {}}
      {...props}
    />,
  );
}

describe('SearchResultsView', () => {
  it('рендерит колонки в заданном порядке', () => {
    const { container } = renderView();

    const headers = Array.from(container.querySelectorAll('th')).map((th) => th.textContent);
    expect(headers).toEqual([
      'Дата добавления',
      'Контрагент',
      'Сумма',
      'Статус',
      'Дата оплаты',
      'Назначение',
    ]);
  });

  it('показывает дату оплаты в формате DD.MM.YYYY жирным', () => {
    renderView();

    const paidDate = screen.getByText('02.06.2026');
    expect(paidDate).toHaveStyle({ fontWeight: '700' });
  });

  it('показывает прочерк, когда дата оплаты пустая', () => {
    renderView({ searchResults: [{ ...invoice, paid_date: '' }] });

    const dash = screen.getByText('—');
    expect(dash).toBeInTheDocument();
    expect(dash).not.toHaveStyle({ fontWeight: '700' });
  });

  it('скрывает колонку «Дата оплаты», когда canViewPaidDate = false', () => {
    const { container } = renderView({ canViewPaidDate: false });

    const headers = Array.from(container.querySelectorAll('th')).map((th) => th.textContent);
    expect(headers).not.toContain('Дата оплаты');
    expect(screen.queryByText('02.06.2026')).not.toBeInTheDocument();
  });

  it('обрезает длинное назначение, сохраняя полный текст в title', () => {
    renderView({ searchResults: [{ ...invoice, purpose: longPurpose }] });

    const purpose = screen.getByText(longPurpose);
    expect(purpose).toBeInTheDocument();
    expect(purpose).toHaveAttribute('title', longPurpose);
  });

  it('вызывает onOpenInvoice по клику на строку', async () => {
    const user = userEvent.setup();
    const onOpenInvoice = vi.fn();
    renderView({ onOpenInvoice });

    const row = screen.getByText('ООО "Тест"').closest('tr')!;
    await user.click(row);

    expect(onOpenInvoice).toHaveBeenCalledTimes(1);
    expect(onOpenInvoice).toHaveBeenCalledWith(invoice);
  });

  it('вызывает onOpenInvoice по Enter на сфокусированной строке', async () => {
    const user = userEvent.setup();
    const onOpenInvoice = vi.fn();
    renderView({ onOpenInvoice });

    const row = screen.getByText('ООО "Тест"').closest('tr')!;
    row.focus();
    await user.keyboard('{Enter}');

    expect(onOpenInvoice).toHaveBeenCalledTimes(1);
    expect(onOpenInvoice).toHaveBeenCalledWith(invoice);
  });
});
