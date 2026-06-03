import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { OrganizationAdminTable } from './OrganizationAdminTable';
import { org1, org2, bankAcc1, bankAcc2, accObj1, accObj2 } from '@/mocks/seed';
import type { IBankAccount, IAccountingObject } from '@/shared/types';

vi.mock('@/api/client');

const accountsByOrg: Record<string, IBankAccount[]> = {
  org1: [bankAcc1, bankAcc2],
  org2: [],
};

const objectsByOrg: Record<string, IAccountingObject[]> = {
  org1: [accObj1, accObj2],
  org2: [],
};

describe('OrganizationAdminTable', () => {
  it('renders organizations with accounts and objects', () => {
    renderWithProviders(
      <OrganizationAdminTable
        organizations={[org1, org2]}
        accountsByOrg={accountsByOrg}
        objectsByOrg={objectsByOrg}
        colorName={{ '#228be6': 'Синий' }}
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText('Организации')).toBeInTheDocument();
    expect(screen.getByText('ООО "Тест"')).toBeInTheDocument();
    expect(screen.getByText('ООО "Демо"')).toBeInTheDocument();
    expect(screen.getByText('4070281012345')).toBeInTheDocument();
    expect(screen.getByText('Основная деятельность')).toBeInTheDocument();
  });

  it('calls onAdd when add button clicked', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    renderWithProviders(
      <OrganizationAdminTable
        organizations={[org1]}
        accountsByOrg={accountsByOrg}
        objectsByOrg={objectsByOrg}
        colorName={{}}
        onAdd={onAdd}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    await user.click(screen.getByText('Добавить организацию'));

    expect(onAdd).toHaveBeenCalledOnce();
  });
});
