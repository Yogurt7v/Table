import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { EditUserModal } from './EditUserModal';
import { adminUser, userUser } from '@/mocks/seed';

vi.mock('@/api/client');

const mockUseUpdateUser = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockNotifyShow = vi.hoisted(() => vi.fn());

vi.mock('@/shared/hooks/useUsers', () => ({
  useUpdateUser: mockUseUpdateUser,
}));

vi.mock('@/shared/context/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mockNotifyShow },
}));

function setupMutation() {
  const mutateAsync = vi.fn().mockResolvedValue({});
  mockUseUpdateUser.mockReturnValue({ mutateAsync, isPending: false });
  return { mutateAsync };
}

describe('EditUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: adminUser });
    setupMutation();
  });

  it('prefills name and login fields', () => {
    renderWithProviders(<EditUserModal opened user={userUser} onClose={vi.fn()} />);

    expect(screen.getByLabelText(/Имя/)).toHaveValue('Пользователь');
    expect(screen.getByLabelText(/Логин/)).toHaveValue('user');
  });

  it('validates empty name', async () => {
    const user = userEvent.setup();
    const { mutateAsync } = setupMutation();

    renderWithProviders(<EditUserModal opened user={userUser} onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText(/Имя/));
    await user.click(screen.getByText('Сохранить'));

    expect(screen.getByText('Укажите имя')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('validates login length', async () => {
    const user = userEvent.setup();
    const { mutateAsync } = setupMutation();

    renderWithProviders(<EditUserModal opened user={userUser} onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText(/Логин/));
    await user.type(screen.getByLabelText(/Логин/), 'u');
    await user.click(screen.getByText('Сохранить'));

    expect(screen.getByText('Логин должен быть не менее 2 символов')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('validates password mismatch', async () => {
    const user = userEvent.setup();
    const { mutateAsync } = setupMutation();

    renderWithProviders(<EditUserModal opened user={userUser} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Новый пароль/), 'password123');
    await user.type(screen.getByLabelText(/Повтор пароля/), 'password124');
    await user.click(screen.getByText('Сохранить'));

    expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('submits and closes on success', async () => {
    const user = userEvent.setup();
    const { mutateAsync } = setupMutation();
    const onClose = vi.fn();

    renderWithProviders(<EditUserModal opened user={userUser} onClose={onClose} />);

    await user.clear(screen.getByLabelText(/Имя/));
    await user.type(screen.getByLabelText(/Имя/), 'Новый');
    await user.click(screen.getByText('Сохранить'));

    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'user1',
      name: 'Новый',
      login: 'user',
      password: undefined,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows toast when login changed for another user', async () => {
    const user = userEvent.setup();

    renderWithProviders(<EditUserModal opened user={userUser} onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText(/Логин/));
    await user.type(screen.getByLabelText(/Логин/), 'new-login');
    await user.click(screen.getByText('Сохранить'));

    expect(mockNotifyShow).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'yellow',
        title: 'Логин изменён',
      }),
    );
  });

  it('does not toast when editing own login', async () => {
    const user = userEvent.setup();

    mockUseAuth.mockReturnValue({ user: userUser });

    renderWithProviders(<EditUserModal opened user={userUser} onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText(/Логин/));
    await user.type(screen.getByLabelText(/Логин/), 'my-new-login');
    await user.click(screen.getByText('Сохранить'));

    expect(mockNotifyShow).not.toHaveBeenCalled();
  });
});
