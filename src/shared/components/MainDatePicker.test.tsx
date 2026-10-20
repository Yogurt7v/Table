import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MainDatePicker } from './MainDatePicker';

const mockUseInvoiceNavigation = vi.hoisted(() => vi.fn());

vi.mock('@/shared/context/InvoiceNavigationContext', () => ({
  useInvoiceNavigation: mockUseInvoiceNavigation,
}));

function setup(variant: 'page' | 'header', selectedDate: Date = new Date('2024-01-15')) {
  mockUseInvoiceNavigation.mockReturnValue({
    selectedDate,
    setSelectedDate: vi.fn(),
  });

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
  return { inputButton };
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
});
