import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MantineProvider, createTheme } from '@mantine/core';
import { MailParentPicker } from './MailParentPicker';
import type { MailCandidate, MailCandidateLookup } from './mail-parent';

const theme = createTheme({});

const candidates: MailCandidate[] = [
  { key: '1', number: '100', counterparty: 'ООО Ромашка', subject: 'Счёт на оплату', type: 'incoming', dateKey: '2024-01-15' },
  { key: '2', number: '200', counterparty: 'ИП Иванов', subject: 'Акт выполненных работ', type: 'outgoing', dateKey: '2024-01-16' },
  { key: '3', number: '300', counterparty: 'ООО Ромашка', subject: 'Договор', type: 'incoming', dateKey: '2024-01-17' },
];

const lookup: MailCandidateLookup = { all: candidates };

function renderWithProviders(ui: React.ReactNode) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

function getModal() {
  return screen.getByRole('dialog');
}

describe('MailParentPicker', () => {
  it('при opened=false тело не рендерится', () => {
    const { container } = renderWithProviders(
      <MailParentPicker
        opened={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        candidates={lookup}
        selfKey={null}
        childLabel="Письмо 42"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('при opened=true рендерит заголовок с childLabel', () => {
    renderWithProviders(
      <MailParentPicker
        opened
        onClose={vi.fn()}
        onSelect={vi.fn()}
        candidates={lookup}
        selfKey={null}
        childLabel="Письмо 42"
      />,
    );
    const modal = getModal();
    expect(within(modal).getByText(/Письмо, на которое отвечает: Письмо 42/)).toBeInTheDocument();
  });

  it('отображает всех кандидатов', () => {
    renderWithProviders(
      <MailParentPicker
        opened
        onClose={vi.fn()}
        onSelect={vi.fn()}
        candidates={lookup}
        selfKey={null}
        childLabel="Письмо 42"
      />,
    );
    const modal = getModal();
    expect(within(modal).getByText('100')).toBeInTheDocument();
    expect(within(modal).getByText('200')).toBeInTheDocument();
    expect(within(modal).getByText('300')).toBeInTheDocument();
  });

  it('фильтрует по поисковому тексту', () => {
    renderWithProviders(
      <MailParentPicker
        opened
        onClose={vi.fn()}
        onSelect={vi.fn()}
        candidates={lookup}
        selfKey={null}
        childLabel="Письмо 42"
      />,
    );
    const modal = getModal();
    const input = within(modal).getByRole('textbox');
    fireEvent.change(input, { target: { value: '200' } });
    expect(within(modal).getByText('200')).toBeInTheDocument();
    expect(within(modal).queryByText('100')).not.toBeInTheDocument();
  });

  it('показывает «Писем не найдено» при пустом результате', () => {
    renderWithProviders(
      <MailParentPicker
        opened
        onClose={vi.fn()}
        onSelect={vi.fn()}
        candidates={lookup}
        selfKey={null}
        childLabel="Письмо 42"
      />,
    );
    const modal = getModal();
    const input = within(modal).getByRole('textbox');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(within(modal).getByText('Писем не найдено')).toBeInTheDocument();
  });

  it('исключает selfKey из кандидатов', () => {
    renderWithProviders(
      <MailParentPicker
        opened
        onClose={vi.fn()}
        onSelect={vi.fn()}
        candidates={lookup}
        selfKey="1"
        childLabel="Письмо 42"
      />,
    );
    const modal = getModal();
    expect(within(modal).queryByText('100')).not.toBeInTheDocument();
    expect(within(modal).getByText('200')).toBeInTheDocument();
  });

  it('клик по кандидату вызывает onSelect и onClose', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <MailParentPicker
        opened
        onClose={onClose}
        onSelect={onSelect}
        candidates={lookup}
        selfKey={null}
        childLabel="Письмо 42"
      />,
    );
    const modal = getModal();
    fireEvent.click(within(modal).getByText('200'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ key: '2', counterparty: 'ИП Иванов' }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
