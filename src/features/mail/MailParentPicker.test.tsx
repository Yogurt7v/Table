import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MantineProvider, createTheme } from '@mantine/core';
import { MailParentPicker } from './MailParentPicker';
import type { MailCandidate, MailCandidateLookup } from './mail-parent';

const theme = createTheme({});

const candidates: MailCandidate[] = [
  { key: 'incoming:1', id: 'm1', number: '100', counterparty: 'ООО Ромашка', subject: 'Счёт на оплату', type: 'incoming', dateKey: '2024-01-15', seq: 1 },
  { key: 'outgoing:2', id: 'm2', number: '200', counterparty: 'ИП Иванов', subject: 'Акт выполненных работ', type: 'outgoing', dateKey: '2024-01-16', seq: 2 },
  { key: 'incoming:3', id: 'm3', number: '300', counterparty: 'ООО Ромашка', subject: 'Договор', type: 'incoming', dateKey: '2024-01-17', seq: 3 },
];

const lookup: MailCandidateLookup = {
  byNumber: { incoming: new Map(), outgoing: new Map() },
  byKey: new Map(),
  all: candidates,
};

function renderWithProviders(ui: React.ReactNode) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

function getModal() {
  return screen.getByRole('dialog');
}

describe('MailParentPicker', () => {
  it('при opened=false тело не рендерится', () => {
    renderWithProviders(
      <MailParentPicker
        opened={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        candidates={lookup}
        selfKey={null}
        childLabel="Письмо 42"
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

  it('фильтрует по поисковому тексту', async () => {
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
    await waitFor(() => expect(within(modal).queryByText('100')).not.toBeInTheDocument());
    expect(within(modal).getByText('200')).toBeInTheDocument();
  });

  it('показывает «Писем не найдено» при пустом результате', async () => {
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
    await waitFor(() => expect(within(modal).getByText('Писем не найдено')).toBeInTheDocument());
  });

  it('исключает selfKey из кандидатов', () => {
    renderWithProviders(
      <MailParentPicker
        opened
        onClose={vi.fn()}
        onSelect={vi.fn()}
        candidates={lookup}
        selfKey="incoming:1"
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
      expect.objectContaining({ key: 'outgoing:2', counterparty: 'ИП Иванов' }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
