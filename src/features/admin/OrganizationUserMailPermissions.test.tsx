import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { OrganizationUserMailPermissions } from './OrganizationUserMailPermissions';
import type { IOrganizationUser } from '@/shared/types';

const mockUpdateMailPermissions = vi.hoisted(() => vi.fn());
const mockNotifyShow = vi.hoisted(() => vi.fn());

vi.mock('@/api/mail', () => ({
  updateOrganizationUserMailPermissions: mockUpdateMailPermissions,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mockNotifyShow },
}));

const adminAssignment: IOrganizationUser = {
  id: 'ou1',
  user_id: 'admin1',
  organization_id: 'org1',
  role: 'admin',
  objects: ['obj1'],
  can_view_mails: true,
  can_create_incoming_mails: true,
  can_edit_incoming_mails: true,
  can_delete_incoming_mails: true,
  can_create_outgoing_mails: true,
  can_edit_outgoing_mails: true,
  can_delete_outgoing_mails: true,
};

/** A row from a collection that predates the backfill: every flag is absent. */
const unbackfilledAssignment: IOrganizationUser = {
  id: 'ou2',
  user_id: 'guest1',
  organization_id: 'org1',
  role: 'admin',
};

function renderEditor(
  assignment: IOrganizationUser = adminAssignment,
  props: { canEdit?: boolean; onSaved?: () => void } = {},
) {
  return renderWithProviders(
    <OrganizationUserMailPermissions
      assignment={assignment}
      canEdit={props.canEdit ?? true}
      onSaved={props.onSaved}
    />,
  );
}

function getFlag(label: string) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe('OrganizationUserMailPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMailPermissions.mockResolvedValue({});
  });

  it('renders every one of the seven flags in its matrix cell', () => {
    renderEditor();

    expect(getFlag('Видеть почту')).toBeInTheDocument();
    expect(getFlag('Входящие: создание')).toBeInTheDocument();
    expect(getFlag('Входящие: редактирование')).toBeInTheDocument();
    expect(getFlag('Входящие: удаление')).toBeInTheDocument();
    expect(getFlag('Исходящие: создание')).toBeInTheDocument();
    expect(getFlag('Исходящие: редактирование')).toBeInTheDocument();
    expect(getFlag('Исходящие: удаление')).toBeInTheDocument();
  });

  it('labels the direction matrix columns in Russian', () => {
    renderEditor();

    expect(screen.getByText('Создание')).toBeInTheDocument();
    expect(screen.getByText('Редактирование')).toBeInTheDocument();
    expect(screen.getByText('Удаление')).toBeInTheDocument();
    expect(screen.getByText('Входящие')).toBeInTheDocument();
    expect(screen.getByText('Исходящие')).toBeInTheDocument();
  });

  it('mirrors the flags stored on the membership', () => {
    renderEditor({ ...adminAssignment, can_delete_incoming_mails: false });

    expect(getFlag('Видеть почту')).toBeChecked();
    expect(getFlag('Входящие: создание')).toBeChecked();
    expect(getFlag('Входящие: удаление')).not.toBeChecked();
  });

  it('renders absent flags as unchecked rather than granting access', () => {
    renderEditor(unbackfilledAssignment);

    for (const label of [
      'Видеть почту',
      'Входящие: создание',
      'Входящие: редактирование',
      'Входящие: удаление',
      'Исходящие: создание',
      'Исходящие: редактирование',
      'Исходящие: удаление',
    ]) {
      expect(getFlag(label)).not.toBeChecked();
    }
  });

  it('does not derive flags from the role', () => {
    renderEditor({
      ...unbackfilledAssignment,
      role: 'guest',
      can_view_mails: true,
      can_create_incoming_mails: true,
    });

    expect(getFlag('Видеть почту')).toBeChecked();
    expect(getFlag('Входящие: создание')).toBeChecked();
    expect(getFlag('Исходящие: удаление')).not.toBeChecked();
  });

  it('explains that mail rights are separate from the role', () => {
    renderEditor();

    expect(
      screen.getByText(/Почтовые права задаются отдельно от роли и действуют именно на них/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/У пользователя без флага «Видеть почту» раздел «Почта» не отображается/),
    ).toBeInTheDocument();
  });

  it('keeps save disabled until a flag changes', async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();

    await user.click(getFlag('Входящие: удаление'));

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('persists only the seven flags and never writes role or objects', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderEditor({ ...adminAssignment, can_delete_outgoing_mails: false }, { onSaved });

    await user.click(getFlag('Исходящие: удаление'));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(mockUpdateMailPermissions).toHaveBeenCalledOnce());
    expect(mockUpdateMailPermissions).toHaveBeenCalledWith('ou1', {
      can_view_mails: true,
      can_create_incoming_mails: true,
      can_edit_incoming_mails: true,
      can_delete_incoming_mails: true,
      can_create_outgoing_mails: true,
      can_edit_outgoing_mails: true,
      can_delete_outgoing_mails: true,
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(mockNotifyShow).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'green', title: 'Почтовые права сохранены' }),
    );
  });

  it('revokes view access without touching the other six flags', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(getFlag('Видеть почту'));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(mockUpdateMailPermissions).toHaveBeenCalledOnce());
    const [, flags] = mockUpdateMailPermissions.mock.calls[0] as [string, Record<string, boolean>];
    expect(flags.can_view_mails).toBe(false);
    expect(flags.can_create_incoming_mails).toBe(true);
    expect(flags.can_delete_outgoing_mails).toBe(true);
  });

  it('restores the previous value on cancel', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(getFlag('Видеть почту'));
    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(getFlag('Видеть почту')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    expect(mockUpdateMailPermissions).not.toHaveBeenCalled();
  });

  it('notifies and reverts the switch when the write fails', async () => {
    const user = userEvent.setup();
    mockUpdateMailPermissions.mockRejectedValue(new Error('network'));
    renderEditor();

    await user.click(getFlag('Входящие: создание'));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(mockNotifyShow).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red', message: 'Не удалось сохранить почтовые права' }),
      ),
    );
    await waitFor(() => expect(getFlag('Входящие: создание')).toBeChecked());
  });

  it('locks the matrix for a non-admin viewer and hides the save controls', () => {
    renderEditor(adminAssignment, { canEdit: false });

    expect(getFlag('Видеть почту')).toBeDisabled();
    expect(getFlag('Исходящие: удаление')).toBeDisabled();
    expect(screen.getByText('Изменять может только администратор')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сохранить' })).not.toBeInTheDocument();
  });
});
