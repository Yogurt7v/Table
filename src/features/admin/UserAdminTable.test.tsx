import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { UserAdminTable } from './UserAdminTable';
import { adminUser, userUser, guestUser, orgUserAdmin, orgUserUser } from '@/mocks/seed';
import type { IOrganizationUser } from '@/shared/types';

vi.mock('@/api/client');

const mockUseOrg = vi.hoisted(() => vi.fn());

vi.mock('@/shared/context/OrgContext', () => ({
  useOrg: mockUseOrg,
}));

const baseProps = {
  users: [adminUser, userUser],
  orgUsers: [orgUserAdmin, orgUserUser] as IOrganizationUser[],
  currentUserId: 'admin1',
  canEdit: true,
  onAdd: () => {},
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe('UserAdminTable', () => {
  beforeEach(() => {
    mockUseOrg.mockReturnValue({
      currentOrgId: 'org1',
      setCurrentOrgId: vi.fn(),
      currentOrg: { id: 'org1', name: 'ООО "Тест"', color: '#228be6' },
      organizations: [{ id: 'org1', name: 'ООО "Тест"', color: '#228be6' }],
    });
  });

  it('renders user list', () => {
    renderWithProviders(<UserAdminTable {...baseProps} />);

    expect(screen.getByText('Пользователи')).toBeInTheDocument();
    expect(screen.getByText('Админ')).toBeInTheDocument();
    expect(screen.getAllByText('Пользователь').length).toBeGreaterThanOrEqual(1);
  });

  it('shows delete button only for non-current users', () => {
    renderWithProviders(<UserAdminTable {...baseProps} />);

    expect(
      screen.getByRole('button', { name: 'Удалить пользователя Пользователь' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Удалить пользователь Админ' }),
    ).not.toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    renderWithProviders(<UserAdminTable {...baseProps} onEdit={onEdit} />);

    await user.click(
      screen.getByRole('button', { name: 'Редактировать пользователя Пользователь' }),
    );
    expect(onEdit).toHaveBeenCalledWith(userUser);
  });

  it('hides edit buttons when canEdit is false', () => {
    renderWithProviders(<UserAdminTable {...baseProps} canEdit={false} />);

    expect(
      screen.queryByRole('button', { name: 'Редактировать пользователя Пользователь' }),
    ).not.toBeInTheDocument();
  });

  it('filters users by search query', async () => {
    const user = userEvent.setup();

    renderWithProviders(<UserAdminTable {...baseProps} users={[adminUser, userUser, guestUser]} />);

    await user.type(screen.getByLabelText('Поиск пользователей'), 'гост');

    expect(screen.getByText('guest')).toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
    expect(screen.queryByText('user')).not.toBeInTheDocument();
  });

  it('shows empty state when nothing matches', async () => {
    const user = userEvent.setup();

    renderWithProviders(<UserAdminTable {...baseProps} users={[adminUser]} orgUsers={[]} />);

    await user.type(screen.getByLabelText('Поиск пользователей'), 'несуществующий');

    expect(screen.getByText('Никого не найдено')).toBeInTheDocument();
  });

  it('calls onAdd when add button clicked', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    renderWithProviders(<UserAdminTable {...baseProps} onAdd={onAdd} />);

    await user.click(screen.getByText('Добавить пользователя'));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
