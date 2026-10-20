import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseOrg = vi.hoisted(() => vi.fn());
const mockUseSearch = vi.hoisted(() => vi.fn());
const mockUseInvoiceNavigation = vi.hoisted(() => vi.fn());
const mockUseDatePinned = vi.hoisted(() => vi.fn());
const mockUseBankAccounts = vi.hoisted(() => vi.fn());
const mockUseCurrentUserRole = vi.hoisted(() => vi.fn());

vi.mock('@/shared/context/AuthContext', () => ({ useAuth: mockUseAuth }));
vi.mock('@/shared/context/OrgContext', () => ({ useOrg: mockUseOrg }));
vi.mock('@/shared/context/SearchContext', () => ({ useSearch: mockUseSearch }));
vi.mock('@/shared/context/InvoiceNavigationContext', () => ({
  useInvoiceNavigation: mockUseInvoiceNavigation,
}));
vi.mock('@/shared/context/DatePinnedContext', () => ({
  DatePinnedProvider: ({ children }: { children: React.ReactNode }) => children,
  useDatePinned: mockUseDatePinned,
}));
vi.mock('@/shared/hooks/useBankAccounts', () => ({ useBankAccounts: mockUseBankAccounts }));
vi.mock('@/shared/hooks/useCurrentUserRole', () => ({
  useCurrentUserRole: mockUseCurrentUserRole,
}));

vi.mock('@/features/invoices/InvoiceSearch', () => ({
  InvoiceSearch: () => <div data-testid="invoice-search" />,
}));
vi.mock('@/features/notifications/NotificationsBell', () => ({
  NotificationsBell: () => <div data-testid="notifications-bell" />,
}));
vi.mock('@/shared/components/MainDatePicker', () => ({
  MainDatePicker: () => <div data-testid="date-picker" />,
}));
vi.mock('@/features/accounts/AccountList', () => ({
  AccountList: () => <div data-testid="account-list" />,
}));
vi.mock('@/features/invoices/InvoiceSection', () => ({
  InvoiceSection: () => <div data-testid="invoice-section" />,
}));

function setupApp(route: string, { isAuthenticated = true } = {}) {
  mockUseAuth.mockReturnValue({
    user: isAuthenticated ? { id: 'u1', email: 'test@test.com', name: 'Test' } : null,
    isAuthenticated,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
  mockUseOrg.mockReturnValue({
    currentOrgId: 'org1',
    currentOrg: { id: 'org1', name: 'Test Org' },
    organizations: [{ id: 'org1', name: 'Test Org' }],
    organizationsLoading: false,
  });
  mockUseSearch.mockReturnValue({
    searchText: '',
    searchAll: false,
    setSearchText: vi.fn(),
    setSearchAll: vi.fn(),
  });
  mockUseInvoiceNavigation.mockReturnValue({
    selectedDate: new Date('2024-01-15'),
    setSelectedDate: vi.fn(),
  });
  mockUseDatePinned.mockReturnValue({ pinned: false, registerAnchor: vi.fn() });
  mockUseBankAccounts.mockReturnValue({ data: [], isLoading: false });
  mockUseCurrentUserRole.mockReturnValue('admin');

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит страницу логина по /login', () => {
    setupApp('/login');
    expect(screen.getByPlaceholderText('Ваш логин')).toBeInTheDocument();
  });

  it('неавторизованный пользователь перенаправляется на /login', () => {
    setupApp('/', { isAuthenticated: false });
    expect(screen.getByPlaceholderText('Ваш логин')).toBeInTheDocument();
  });

  it('неизвестный маршрут перенаправляет на /', () => {
    setupApp('/unknown-route');
    expect(screen.getByTestId('invoice-section')).toBeInTheDocument();
  });
});
