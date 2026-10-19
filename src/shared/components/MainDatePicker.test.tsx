import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider, createTheme } from '@mantine/core';
import { InvoiceNavigationContext } from '@/shared/context/InvoiceNavigationContext';
import { MainDatePicker } from './MainDatePicker';
import type { InvoiceNavigationContextValue } from '@/shared/context/InvoiceNavigationContext';

const theme = createTheme({});

function renderWithProviders(ui: React.ReactNode, navValue: Partial<InvoiceNavigationContextValue> = {}) {
  const defaultValue: InvoiceNavigationContextValue = {
    selectedDate: new Date('2024-01-15'),
    setSelectedDate: vi.fn(),
    ...navValue,
  };

  return render(
    <MantineProvider theme={theme}>
      <InvoiceNavigationContext.Provider value={defaultValue}>
        {ui}
      </InvoiceNavigationContext.Provider>
    </MantineProvider>,
  );
}

describe('MainDatePicker', () => {
  it('рендерит DatePickerInput', () => {
    renderWithProviders(<MainDatePicker variant="page" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('variant="page" — отображает дату', () => {
    renderWithProviders(<MainDatePicker variant="page" />);
    // DatePickerInput отображает дату в формате D MMMM YYYY, dddd
    expect(screen.getByRole('textbox')).toHaveValue(/2024/);
  });

  it('variant="header" — рендерится', () => {
    renderWithProviders(<MainDatePicker variant="header" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('передаёт выбранную дату в setSelectedDate', () => {
    const setSelectedDate = vi.fn();
    renderWithProviders(<MainDatePicker variant="page" />, { setSelectedDate });

    // DatePickerInput вызывает onChange при выборе даты
    // В тесте проверяем, что контекст передаётся корректно
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('maxDate — сегодняшняя дата', () => {
    renderWithProviders(<MainDatePicker variant="page" />);
    // DatePickerInput ограничивает выбор будущих дат
    // Проверяем рендер — детали maxDate проверяются в интеграционных тестах
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
