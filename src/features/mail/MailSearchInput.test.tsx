import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MantineProvider, createTheme } from '@mantine/core';
import { MailSearchInput } from './MailSearchInput';

const theme = createTheme({});

function renderWithProviders(ui: React.ReactNode) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

describe('MailSearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('рендерит поле ввода с плейсхолдером', () => {
    renderWithProviders(
      <MailSearchInput value="" onChange={vi.fn()} scopeLabel="письмам" />,
    );
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'Поиск по письмам...',
    );
  });

  it('отображает переданное значение', () => {
    renderWithProviders(
      <MailSearchInput value="тест" onChange={vi.fn()} scopeLabel="письмам" />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('тест');
  });

  it('onChange вызывается после дебаунса 280мс', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MailSearchInput value="" onChange={onChange} scopeLabel="письмам" />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'а' } });

    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(279);
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onChange).toHaveBeenCalledWith('а');
  });

  it('показывает кнопку очистки при непустом тексте', () => {
    renderWithProviders(
      <MailSearchInput value="тест" onChange={vi.fn()} scopeLabel="письмам" />,
    );
    expect(screen.getByLabelText('Очистить поиск')).toBeInTheDocument();
  });

  it('скрывает кнопку очистки при пустом тексте', () => {
    renderWithProviders(
      <MailSearchInput value="" onChange={vi.fn()} scopeLabel="письмам" />,
    );
    expect(screen.queryByLabelText('Очистить поиск')).not.toBeInTheDocument();
  });

  it('очистка сбрасывает значение и вызывает onChange', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MailSearchInput value="тест" onChange={onChange} scopeLabel="письмам" />,
    );

    fireEvent.click(screen.getByLabelText('Очистить поиск'));

    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('показывает счётчик результатов', () => {
    renderWithProviders(
      <MailSearchInput
        value="тест"
        onChange={vi.fn()}
        scopeLabel="письмам"
        resultCount={5}
        resultTotal={10}
      />,
    );
    expect(screen.getByText('Найдено: 5 из 10')).toBeInTheDocument();
  });

  it('показывает общий счётчик когда resultCount === resultTotal', () => {
    renderWithProviders(
      <MailSearchInput
        value="тест"
        onChange={vi.fn()}
        scopeLabel="письмам"
        resultCount={7}
        resultTotal={7}
      />,
    );
    expect(screen.getByText('Найдено: 7')).toBeInTheDocument();
  });

  it('скрывает счётчик когда значение пустое', () => {
    renderWithProviders(
      <MailSearchInput
        value=""
        onChange={vi.fn()}
        scopeLabel="письмам"
        resultCount={5}
        resultTotal={10}
      />,
    );
    expect(screen.queryByText(/Найдено/)).not.toBeInTheDocument();
  });
});
