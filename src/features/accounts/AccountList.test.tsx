import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AccountList } from './AccountList';
import { bankAcc1, bankAcc2 } from '@/mocks/seed';
import type { IAccountWithBalance } from '@/shared/types';

const mockHooks = vi.hoisted(() => {
  let mockRole: string | undefined = 'admin';
  return {
    setRole: (r: string | undefined) => { mockRole = r; },
    useAuth: () => {
      const users: Record<string, { id: string; login: string }> = {
        user1: { id: 'user1', login: 'admin' },
        user3: { id: 'user3', login: 'guest' },
      };
      const userId = mockRole === 'guest' ? 'user3' : 'user1';
      return { user: users[userId], isAuthenticated: true, isLoading: false };
    },
    useOrg: () => ({ currentOrgId: 'org1', currentOrg: { id: 'org1', name: 'Test Org' }, organizations: [] }),
    useOrganizationUsers: () => {
      const roleVal = mockRole;
      return {
        data: roleVal
          ? [{ id: 'ou_test', user_id: roleVal === 'guest' ? 'user3' : 'user1', organization_id: 'org1', role: roleVal }]
          : undefined,
      };
    },
    useUpdateBalance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

vi.mock('@/shared/context/AuthContext', () => ({
  useAuth: mockHooks.useAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/shared/context/OrgContext', () => ({
  useOrg: mockHooks.useOrg,
  OrgProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/shared/hooks/useOrganizationUsers', () => ({
  useOrganizationUsers: mockHooks.useOrganizationUsers,
}));

vi.mock('@/shared/hooks/useBankAccounts', () => ({
  useUpdateBalance: mockHooks.useUpdateBalance,
}));

vi.mock('@/api/client', () => ({}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });

const accounts: IAccountWithBalance[] = [
  { account: bankAcc1, balance: 150000 },
  { account: bankAcc2, balance: 85000 },
];

function renderAccountList(accs: IAccountWithBalance[] | undefined, loading = false, date = '2026-06-03') {
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider defaultColorScheme="light">
        <MemoryRouter>
          <AccountList accounts={accs} loading={loading} date={date} />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('AccountList', () => {
  beforeEach(() => {
    mockHooks.setRole('admin');
  });

  it('renders list of accounts', async () => {
    renderAccountList(accounts);

    await waitFor(() => {
      expect(screen.getByText('4070281012345')).toBeInTheDocument();
    });

    expect(screen.getByText('4070281098765')).toBeInTheDocument();
    expect(screen.getByText(/150 000/)).toBeInTheDocument();
    expect(screen.getByText(/85 000/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderAccountList(undefined, true);

    expect(screen.getByText('Расчётные счета')).toBeInTheDocument();
  });

  it('hidden for guest role', async () => {
    mockHooks.setRole('guest');
    renderAccountList(accounts);

    await waitFor(() => {
      expect(screen.queryByText('Расчётные счета')).not.toBeInTheDocument();
    });
  });
});
