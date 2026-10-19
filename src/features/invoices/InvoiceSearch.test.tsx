import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider, createTheme } from '@mantine/core';
import { InvoiceSearch } from './InvoiceSearch';
import { SearchContext } from '@/shared/context/SearchContext';
import type { SearchContextValue } from '@/shared/context/SearchContext';

const theme = createTheme({});

function renderWithProviders(ui: React.ReactNode, searchValue: Partial<SearchContextValue> = {}) {
  const defaultValue: SearchContextValue = {
    searchText: '',
    searchAll: false,
    setSearchText: vi.fn(),
    setSearchAll: vi.fn(),
    ...searchValue,
  };

  return render(
    <MantineProvider theme={theme}>
      <SearchContext.Provider value={defaultValue}>{ui}</SearchContext.Provider>
    </MantineProvider>,
  );
}

describe('InvoiceSearch', () => {
  it('рендерит поле ввода с плейсхолдером', () => {
    renderWithProviders(<InvoiceSearch />);
    expect(screen.getByPlaceholderText('Поиск по счетам...')).toBeInTheDocument();
  });

  it('отображает текущее значение поиска', () => {
    renderWithProviders(<InvoiceSearch />, { searchText: 'тест' });
    expect(screen.getByRole('textbox')).toHaveValue('тест');
  });

  it('onChange вызывает setSearchText и setSearchAll(false)', () => {
    const setSearchText = vi.fn();
    const setSearchAll = vi.fn();
    renderWithProviders(<InvoiceSearch />, { setSearchText, setSearchAll });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'а' } });

    expect(setSearchText).toHaveBeenCalledWith('а');
    expect(setSearchAll).toHaveBeenCalledWith(false);
  });

  it('показывает кнопку очистки при непустом тексте', () => {
    renderWithProviders(<InvoiceSearch />, { searchText: 'тест' });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('скрывает кнопку очистки при пустом тексте', () => {
    renderWithProviders(<InvoiceSearch />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('показывает кнопку «Искать в других датах» при поиске в текущей дате', () => {
    renderWithProviders(<InvoiceSearch />, { searchText: 'тест', searchAll: false });
    expect(screen.getByText('Искать в других датах')).toBeInTheDocument();
  });

  it('скрывает кнопку «Искать в других датах» при searchAll=true', () => {
    renderWithProviders(<InvoiceSearch />, { searchText: 'тест', searchAll: true });
    expect(screen.queryByText('Искать в других датах')).not.toBeInTheDocument();
  });

  it('очистка сбрасывает поиск', () => {
    const setSearchText = vi.fn();
    renderWithProviders(<InvoiceSearch />, { searchText: 'тест', setSearchText });

    fireEvent.click(screen.getByRole('button'));
    expect(setSearchText).toHaveBeenCalledWith('');
  });
});
