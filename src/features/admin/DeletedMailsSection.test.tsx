import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { DeletedMailsSection } from './DeletedMailsSection';
import type { IDeletedIncomingMail } from '@/shared/types';

const mocks = vi.hoisted(() => ({
  deletedIncoming: vi.fn(),
  deletedOutgoing: vi.fn(),
  allDeletedIncoming: vi.fn(),
  allDeletedOutgoing: vi.fn(),
  restoreIncoming: vi.fn(),
  useMailPermissions: vi.fn(),
}));

vi.mock('@/shared/hooks/useMail', () => ({
  useDeletedIncomingMails: mocks.deletedIncoming,
  useDeletedOutgoingMails: mocks.deletedOutgoing,
  useAllDeletedIncomingMails: mocks.allDeletedIncoming,
  useAllDeletedOutgoingMails: mocks.allDeletedOutgoing,
  useRestoreDeletedIncomingMail: () => ({ mutateAsync: mocks.restoreIncoming, isPending: false }),
  useRestoreDeletedOutgoingMail: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/shared/hooks/useMailPermissions', () => ({
  useMailPermissions: mocks.useMailPermissions,
}));

vi.mock('@/shared/hooks/useAccountingObjects', () => ({
  useAccountingObjects: () => ({ data: [{ id: 'obj1', name: 'Основной счёт' }] }),
}));

vi.mock('@/features/mail/MailArchiveHistoryModal', () => ({
  DeletedMailHistoryModal: () => <div>история-модалка</div>,
}));

function deletedIncomingMail(i: number): IDeletedIncomingMail {
  return {
    id: `del-${i}`,
    original_id: `mail-${i}`,
    organization_id: 'org1',
    accounting_object_id: i === 1 ? 'obj1' : '',
    seq: i,
    date: '2026-01-15 00:00:00.000Z',
    subject: `Тема письма ${i}`,
    responsible: 'user1',
    sender: `Отправитель ${i}`,
    number: `И-${i}`,
    deleted_by: 'admin1',
    deleted_by_name: 'Админ',
    deleted_at: '2026-02-01 10:00:00.000Z',
    comment: '',
  };
}

const archive = Array.from({ length: 3 }, (_, idx) => deletedIncomingMail(idx + 1));

function page(items: IDeletedIncomingMail[], totalPages = 1) {
  return { items, page: 1, perPage: 15, totalItems: items.length, totalPages };
}

function renderSection() {
  return renderWithProviders(<DeletedMailsSection orgId="org1" />);
}

describe('DeletedMailsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deletedIncoming.mockReturnValue({ data: page(archive), isLoading: false });
    mocks.deletedOutgoing.mockReturnValue({ data: page([]), isLoading: false });
    mocks.allDeletedIncoming.mockReturnValue({ data: archive, isLoading: false });
    mocks.allDeletedOutgoing.mockReturnValue({ data: [], isLoading: false });
    mocks.useMailPermissions.mockReturnValue({ canRestore: true, canViewArchive: true });
  });

  it('показывает архивные письма с темой, контрагентом и кнопками действий', async () => {
    renderSection();

    expect(await screen.findByText('Тема письма 1')).toBeInTheDocument();
    expect(screen.getByText('Отправитель 1')).toBeInTheDocument();
    expect(screen.getByText('Основной счёт')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Просмотреть' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Восстановить' })).toHaveLength(3);
  });

  it('прячет кнопку восстановления без флага canRestore', async () => {
    mocks.useMailPermissions.mockReturnValue({ canRestore: false, canViewArchive: true });
    renderSection();

    expect(await screen.findByText('Тема письма 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Восстановить' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'История' })).toHaveLength(3);
  });

  it('ищет по всему архиву после активации поиска', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Тема письма 1');

    const input = screen.getByLabelText('Поиск в архиве сообщений');
    await user.type(input, 'письма 3');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.queryByText('Тема письма 1')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Тема письма 3')).toBeInTheDocument();
    expect(mocks.allDeletedIncoming).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    expect(await screen.findByText('Тема письма 1')).toBeInTheDocument();
  });

  it('открывает модалку просмотра с данными письма', async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('Тема письма 1');
    await user.click(screen.getAllByRole('button', { name: 'Просмотреть' })[0]!);

    expect(await screen.findByText('Входящее письмо № И-1')).toBeInTheDocument();
    expect(screen.getAllByText('Отправитель 1')).toHaveLength(2);
    expect(screen.getAllByText('Тема письма 1')).toHaveLength(2);
  });

  it('пустой архив показывает «Архив пуст»', async () => {
    mocks.deletedIncoming.mockReturnValue({ data: page([]), isLoading: false });
    renderSection();

    expect(await screen.findByText('Архив пуст')).toBeInTheDocument();
  });
});
