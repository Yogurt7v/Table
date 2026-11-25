import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MainDatePicker } from './MainDatePicker';

const mockUseInvoiceNavigation = vi.hoisted(() => vi.fn());
const mockUseSearch = vi.hoisted(() => vi.fn());

vi.mock('@/shared/context/InvoiceNavigationContext', () => ({
  useInvoiceNavigation: mockUseInvoiceNavigation,
}));

vi.mock('@/shared/context/SearchContext', () => ({
  useSearch: mockUseSearch,
}));

function setup(variant: 'page' | 'header', selectedDate: Date = new Date('2024-01-15')) {
  const setSelectedDate = vi.fn();
  const setSearchAll = vi.fn();
  mockUseInvoiceNavigation.mockReturnValue({
    selectedDate,
    setSelectedDate,
  });
  mockUseSearch.mockReturnValue({ setSearchAll });

  const utils = render(
    <MantineProvider>
      <MainDatePicker variant={variant} />
    </MantineProvider>,
  );

  // Mantine v7 рендерит DatePickerInput как <button type="button">, а не <input>
  const inputButton = utils.container.querySelector<HTMLButtonElement>(
    '.mantine-DatePickerInput-input',
  );
  if (!inputButton) throw new Error('Кнопка DatePickerInput не найдена');
  return { inputButton, setSelectedDate, setSearchAll, ...utils };
}

describe('MainDatePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит DatePickerInput с выбранной датой', () => {
    const { inputButton } = setup('page');
    expect(inputButton).toHaveTextContent(/2024/);
  });

  it('variant="header" — рендерится', () => {
    const { inputButton } = setup('header');
    expect(inputButton).toBeInTheDocument();
  });

  it('клик по инпуту открывает календарь', () => {
    const { inputButton } = setup('page');
    expect(inputButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(inputButton);
    expect(inputButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('показывает кнопку «Сегодня» и сбрасывает дату и поиск по всем датам', () => {
    const { getByRole, setSelectedDate, setSearchAll } = setup('page', new Date('2024-01-15'));

    fireEvent.click(getByRole('button', { name: /Сегодня/i }));

    expect(setSelectedDate).toHaveBeenCalledTimes(1);
    expect(setSearchAll).toHaveBeenCalledWith(false);
  });

  it('не показывает кнопку «Сегодня» для текущей даты', () => {
    const { queryByRole } = setup('page', new Date());

    expect(queryByRole('button', { name: /Сегодня/i })).not.toBeInTheDocument();
  });
});
