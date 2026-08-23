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
    renderWithProviders(
      <UserAdminTable
        users={[adminUser, userUser]}
        orgUsers={[orgUserAdmin, orgUserUser] as IOrganizationUser[]}
        currentUserId="admin1"
        onAdd={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText('Пользователи')).toBeInTheDocument();
    expect(screen.getByText('Админ')).toBeInTheDocument();
    expect(screen.getAllByText('Пользователь').length).toBeGreaterThanOrEqual(1);
  });

  it('shows delete button only for non-current users', () => {
    renderWithProviders(
      <UserAdminTable
        users={[adminUser, userUser]}
        orgUsers={[orgUserAdmin, orgUserUser] as IOrganizationUser[]}
        currentUserId="admin1"
        onAdd={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Удалить пользователя Пользователь' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить пользователь Админ' })).not.toBeInTheDocument();
  });

  it('filters users by search query', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <UserAdminTable
        users={[adminUser, userUser, guestUser]}
        orgUsers={[orgUserAdmin, orgUserUser] as IOrganizationUser[]}
        currentUserId="admin1"
        onAdd={() => {}}
        onDelete={() => {}}
      />,
    );

    await user.type(screen.getByLabelText('Поиск пользователей'), 'гост');

    expect(screen.getByText('guest')).toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
    expect(screen.queryByText('user')).not.toBeInTheDocument();
  });

  it('shows empty state when nothing matches', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <UserAdminTable
        users={[adminUser]}
        orgUsers={[]}
        currentUserId="admin1"
        onAdd={() => {}}
        onDelete={() => {}}
      />,
    );

    await user.type(screen.getByLabelText('Поиск пользователей'), 'несуществующий');

    expect(screen.getByText('Никого не найдено')).toBeInTheDocument();
  });

  it('calls onAdd when add button clicked', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    renderWithProviders(
      <UserAdminTable
        users={[adminUser]}
        orgUsers={[]}
        currentUserId="admin1"
        onAdd={onAdd}
        onDelete={() => {}}
      />,
    );

    await user.click(screen.getByText('Добавить пользователя'));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
