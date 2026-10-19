import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeletedMailHistoryModal } from './MailArchiveHistoryModal';
import type { IDeletedMailHistory, MailType } from '@/shared/types';

vi.mock('@/api/mail', () => ({
  getDeletedIncomingMailHistory: vi.fn(),
  getDeletedOutgoingMailHistory: vi.fn(),
}));

vi.mock('./mail-date', () => ({
  formatMailTimestamp: vi.fn((ts: string) => ts),
}));

vi.mock('./mail-labels', () => ({
  MAIL_HISTORY_TYPE_LABELS: { created: 'Создано', updated: 'Изменено', deleted: 'Удалено' },
}));

vi.mock('./mail-history', () => ({
  buildMailHistoryEntries: vi.fn((items: IDeletedMailHistory[]) =>
    items.map((item, i) => ({
      entryId: String(i),
      type: item.type,
      changedAt: item.changed_at,
      author: item.author,
    })),
  ),
}));

import { getDeletedIncomingMailHistory, getDeletedOutgoingMailHistory } from '@/api/mail';

const mockGetIncoming = vi.mocked(getDeletedIncomingMailHistory);
const mockGetOutgoing = vi.mocked(getDeletedOutgoingMailHistory);

const theme = createTheme({});

function renderWithProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>{ui}</MantineProvider>
    </QueryClientProvider>,
  );
}

describe('DeletedMailHistoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('показывает Loader во время загрузки', () => {
    let resolve: (v: unknown) => void = () => {};
    mockGetIncoming.mockImplementationOnce(
      () => new Promise((r) => { resolve = r; }),
    );

    renderWithProviders(
      <DeletedMailHistoryModal
        deletedMailId="del1"
        mailType={'incoming' as MailType}
        mailLabel="Письмо 42"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();

    resolve([]);
  });

  it('показывает «Записей нет» при пустом результате', async () => {
    mockGetIncoming.mockResolvedValueOnce([]);

    renderWithProviders(
      <DeletedMailHistoryModal
        deletedMailId="del1"
        mailType={'incoming' as MailType}
        mailLabel="Письмо 42"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('Записей нет')).toBeInTheDocument();
  });

  it('отображает записи истории', async () => {
    mockGetIncoming.mockResolvedValueOnce([
      { type: 'created', changed_at: '2024-01-15', author: 'Иванов' },
      { type: 'updated', changed_at: '2024-01-16', author: 'Петров' },
    ]);

    renderWithProviders(
      <DeletedMailHistoryModal
        deletedMailId="del1"
        mailType={'incoming' as MailType}
        mailLabel="Письмо 42"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('Создано')).toBeInTheDocument();
    expect(screen.getByText('Изменено')).toBeInTheDocument();
  });

  it('для outgoing вызывает getDeletedOutgoingMailHistory', async () => {
    mockGetOutgoing.mockResolvedValueOnce([]);

    renderWithProviders(
      <DeletedMailHistoryModal
        deletedMailId="del1"
        mailType={'outgoing' as MailType}
        mailLabel="Письмо 42"
        onClose={vi.fn()}
      />,
    );

    await screen.findByText('Записей нет');
    expect(mockGetOutgoing).toHaveBeenCalledWith('del1');
  });

  it('заголовок содержит mailLabel', async () => {
    mockGetIncoming.mockResolvedValueOnce([]);

    renderWithProviders(
      <DeletedMailHistoryModal
        deletedMailId="del1"
        mailType={'incoming' as MailType}
        mailLabel="Письмо 42"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText(/История архива: Письмо 42/)).toBeInTheDocument();
  });
});
