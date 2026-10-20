import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider, createTheme } from '@mantine/core';
import { InvoiceSearch } from './InvoiceSearch';
import { SearchProvider } from '@/shared/context/SearchContext';

const theme = createTheme({});

function renderSearch() {
  return render(
    <MantineProvider theme={theme}>
      <SearchProvider>
        <InvoiceSearch />
      </SearchProvider>
    </MantineProvider>,
  );
}

describe('InvoiceSearch', () => {
  it('рендерит поле ввода с плейсхолдером', () => {
    renderSearch();
    expect(screen.getByPlaceholderText('Поиск по счетам...')).toBeInTheDocument();
  });

  it('введённый текст отображается в поле', () => {
    renderSearch();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'тест' } });
    expect(input).toHaveValue('тест');
  });

  it('при пустом поиске кнопок нет, при вводе появляются очистка и «Искать в других датах»', () => {
    renderSearch();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'тест' } });

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('Искать в других датах')).toBeInTheDocument();
  });

  it('кнопка «Искать в других датах» включает глобальный поиск и исчезает', () => {
    renderSearch();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'тест' } });
    fireEvent.click(screen.getByText('Искать в других датах'));

    expect(screen.queryByText('Искать в других датах')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('новый ввод после включения глобального поиска снова предлагает «Искать в других датах»', () => {
    renderSearch();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'тест' } });
    fireEvent.click(screen.getByText('Искать в других датах'));
    expect(screen.queryByText('Искать в других датах')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'тест 2' } });
    expect(screen.getByText('Искать в других датах')).toBeInTheDocument();
  });

  it('очистка сбрасывает поиск: поле пустое, кнопки исчезают', () => {
    renderSearch();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'тест' } });

    const clearBtn = screen
      .getAllByRole('button')
      .find((b) => !b.textContent?.includes('Искать'));
    if (!clearBtn) throw new Error('Кнопка очистки не найдена');
    fireEvent.click(clearBtn);

    expect(input).toHaveValue('');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
