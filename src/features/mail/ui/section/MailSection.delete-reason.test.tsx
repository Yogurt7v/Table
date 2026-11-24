import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { MailSection } from '../section/MailSection';
import type { MailPermissions } from '@/features/mail/model/mail-field-access';

/**
 * Обязательность причины удаления в единственной модалке `MailSection`.
 *
 * `MailSection` рендерить целиком дорого (вокруг него около пятнадцати хуков
 * данных), поэтому здесь замокано всё, что не относится к проверке: сами хуки
 * `@/api/mail` и листовые компоненты-таблицы. Настоящими остаются `MailSection`,
 * `ConfirmModal` и модалка Mantine — то есть ровно та логика, которая описана
 * ниже.
 */

const MAIL_ID = 'mail01hxyz';

const { deleteIncoming, deleteOutgoing } = vi.hoisted(() => ({
  deleteIncoming: vi.fn(),
  deleteOutgoing: vi.fn(),
}));

const ALL_PERMISSIONS: MailPermissions = {
  canView: true,
  canCreateIncoming: true,
  canEditIncoming: true,
  canDeleteIncoming: true,
  canCreateOutgoing: true,
  canEditOutgoing: true,
  canDeleteOutgoing: true,
  canManageFiles: true,
  canViewHistory: true,
  canRestore: true,
  canViewArchive: true,
};

vi.mock('@/shared/hooks/useMail', () => {
  const emptyPage = { items: [], totalItems: 0, totalPages: 0 };
  const mutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  });
  return {
    useIncomingMails: () => ({ data: emptyPage, isLoading: false }),
    useOutgoingMails: () => ({ data: emptyPage, isLoading: false }),
    useAllIncomingMails: () => ({ data: [], isLoading: false }),
    useAllOutgoingMails: () => ({ data: [], isLoading: false }),
    useIncomingMail: () => ({ data: undefined }),
    useOutgoingMail: () => ({ data: undefined }),
    useCreateIncomingMail: mutation,
    useCreateOutgoingMail: mutation,
    useUpdateIncomingMail: mutation,
    useUpdateOutgoingMail: mutation,
    useDeleteIncomingMail: () => ({
      mutate: deleteIncoming,
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useDeleteOutgoingMail: () => ({
      mutate: deleteOutgoing,
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  };
});

vi.mock('@/shared/hooks/useMailPermissions', () => ({
  useMailPermissions: () => ALL_PERMISSIONS,
}));

vi.mock('@/features/accounts/hooks/useAccessibleObjects', () => ({
  useAccessibleObjects: () => [{ id: 'obj01hxyz', name: 'Основной счёт' }],
}));

vi.mock('@/features/admin/hooks/useOrganizationUsers', () => ({
  useOrganizationUsers: () => ({ data: [] }),
}));

vi.mock('@/features/admin/hooks/useUserMap', () => ({
  useUserMap: () => new Map(),
}));

vi.mock('@/shared/hooks/useUserSettings', () => ({
  useUserSetting: () => ({ data: undefined }),
  useUpsertUserSetting: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/features/mail/hooks/useMailFilters', () => ({
  buildFilterChips: () => [],
  useMailFilters: () => ({
    query: {},
    filters: { search: '', attachments: false, hasRelations: false },
    activeCount: 0,
    setSearch: vi.fn(),
    setCustomRange: vi.fn(),
    resetAll: vi.fn(),
  }),
}));

vi.mock('@/features/mail/hooks/useOrgMailFiles', () => ({
  filterByAttachments: (items: unknown[]) => items,
  filterByRelations: (items: unknown[]) => items,
  useOrgMailFiles: () => ({
    countsByMailId: new Map(),
    namesByMailId: new Map(),
    isSuccess: true,
  }),
  useOrgMailRelationIds: () => ({
    linkedByType: { incoming: new Set(), outgoing: new Set() },
  }),
}));

vi.mock('@/features/mail/hooks/useOrgMailThread', () => ({
  useOrgMailThread: () => ({ parentEdges: new Map(), candidates: [] }),
}));

vi.mock('@/features/mail/hooks/useOrgCounterparties', () => ({
  useOrgCounterparties: () => ({ counterpartyOptions: [] }),
}));

vi.mock('@/features/mail/hooks/useMailLinkChange', () => ({
  useMailLinkChange: () => ({ changeLink: vi.fn(), isPending: false }),
}));

// Таблица заменена триггером: реальные строки с настоящими меню действий ничего
// не добавляют к проверке гейта, а стоят дорого.
vi.mock('../table/MailTable', () => ({
  MailTable: ({ onDelete }: { onDelete: (mailId: string) => void }) => (
    <button type="button" onClick={() => onDelete(MAIL_ID)}>
      Удалить письмо
    </button>
  ),
}));

vi.mock('../filters/MailFilters', () => ({ MailFilters: () => null }));
vi.mock('../search/MailSearchInput', () => ({ MailSearchInput: () => null }));
vi.mock('../form/MailFormModal', () => ({ MailFormModal: () => null }));
vi.mock('../files/MailFilesModal', () => ({ MailFilesModal: () => null }));
vi.mock('../history/MailHistoryModal', () => ({ MailHistoryModal: () => null }));
vi.mock('../thread/MailThreadBuilder', () => ({ MailThreadBuilder: () => null }));
vi.mock('../columns/MailColumnSettingsModal', () => ({ MailColumnSettingsModal: () => null }));

function renderSection() {
  return renderWithProviders(<MailSection orgId="org01hxyz" />);
}

// Модалка Mantine монтируется после анимации появления, поэтому и кнопка, и
// поле ищутся через `findBy*`, а не сразу после клика.
async function openDeleteModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Удалить письмо' }));
  return screen.findByRole('button', { name: 'Удалить' });
}

function reasonInput() {
  return screen.findByLabelText<HTMLInputElement>('Причина удаления');
}

beforeEach(() => {
  deleteIncoming.mockReset();
  deleteOutgoing.mockReset();
});

describe('MailSection — причина удаления письма обязательна', () => {
  it('кнопка подтверждения задизейблена, пока причина пустая', async () => {
    const user = userEvent.setup();
    renderSection();

    const confirm = await openDeleteModal(user);

    expect(await reasonInput()).toBeRequired();
    expect(confirm).toBeDisabled();
  });

  it('причина из одних пробелов гейтом не проходит', async () => {
    const user = userEvent.setup();
    renderSection();

    const confirm = await openDeleteModal(user);
    await user.type(await reasonInput(), '   ');

    expect(confirm).toBeDisabled();
  });

  it('после ввода причины кнопка оживает, а мутация уходит с id и причиной', async () => {
    const user = userEvent.setup();
    renderSection();

    const confirm = await openDeleteModal(user);
    expect(confirm).toBeDisabled();

    await user.type(await reasonInput(), 'причина');

    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(deleteIncoming).toHaveBeenCalledTimes(1);
    expect(deleteIncoming).toHaveBeenCalledWith({ id: MAIL_ID, reason: 'причина' });
    expect(deleteOutgoing).not.toHaveBeenCalled();
  });

  it('причина обрезается от краёв перед отправкой', async () => {
    const user = userEvent.setup();
    renderSection();

    const confirm = await openDeleteModal(user);
    await user.type(await reasonInput(), '  опечатка  ');
    await user.click(confirm);

    expect(deleteIncoming).toHaveBeenCalledWith({ id: MAIL_ID, reason: 'опечатка' });
  });

  it('после закрытия модалки поле пустое, даже если причину уже вводили', async () => {
    const user = userEvent.setup();
    renderSection();

    await openDeleteModal(user);
    await user.type(await reasonInput(), 'причина');
    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Причина удаления')).not.toBeInTheDocument();
    });

    const reopened = await openDeleteModal(user);

    expect(await reasonInput()).toHaveValue('');
    expect(reopened).toBeDisabled();
  });

  it('после подтверждения модалка открывается заново уже пустой', async () => {
    const user = userEvent.setup();
    renderSection();

    const confirm = await openDeleteModal(user);
    await user.type(await reasonInput(), 'причина');
    await user.click(confirm);

    const reopened = await openDeleteModal(user);

    expect(await reasonInput()).toHaveValue('');
    expect(reopened).toBeDisabled();
  });

  it('во вкладке исходящих причину получает исходящая мутация', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('tab', { name: /Исходящие/ }));
    const confirm = await openDeleteModal(user);
    await user.type(await reasonInput(), 'причина');
    await user.click(confirm);

    expect(deleteOutgoing).toHaveBeenCalledWith({ id: MAIL_ID, reason: 'причина' });
    expect(deleteIncoming).not.toHaveBeenCalled();
  });
});
