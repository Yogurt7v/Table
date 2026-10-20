import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MainPage } from './MainPage';

const mockUseOrg = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseSearch = vi.hoisted(() => vi.fn());
const mockUseInvoiceNavigation = vi.hoisted(() => vi.fn());
const mockUseDatePinned = vi.hoisted(() => vi.fn());
const mockUseBankAccounts = vi.hoisted(() => vi.fn());

vi.mock('@/shared/context/OrgContext', () => ({ useOrg: mockUseOrg }));
vi.mock('@/shared/context/AuthContext', () => ({ useAuth: mockUseAuth }));
vi.mock('@/shared/context/SearchContext', () => ({ useSearch: mockUseSearch }));
vi.mock('@/shared/context/InvoiceNavigationContext', () => ({
  useInvoiceNavigation: mockUseInvoiceNavigation,
}));
vi.mock('@/shared/context/DatePinnedContext', () => ({ useDatePinned: mockUseDatePinned }));
vi.mock('@/shared/hooks/useBankAccounts', () => ({ useBankAccounts: mockUseBankAccounts }));

vi.mock('@/shared/components/MainDatePicker', () => ({
  MainDatePicker: () => <div data-testid="date-picker" />,
}));
vi.mock('@/features/accounts/AccountList', () => ({
  AccountList: () => <div data-testid="account-list" />,
}));
vi.mock('@/features/invoices/InvoiceSection', () => ({
  InvoiceSection: () => <div data-testid="invoice-section" />,
}));

interface SetupOptions {
  currentOrgId?: string | null;
  organizationsLoading?: boolean;
}

function setup({ currentOrgId = 'org1', organizationsLoading = false }: SetupOptions = {}) {
  const logout = vi.fn();
  mockUseOrg.mockReturnValue({
    currentOrgId,
    currentOrg: currentOrgId ? { id: currentOrgId, name: 'Test Org' } : null,
    organizations: [],
    organizationsLoading,
  });
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'test@test.com', name: 'Test' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout,
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

  render(
    <MantineProvider>
      <MainPage />
    </MantineProvider>,
  );

  return { logout };
}

describe('MainPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('показывает Loader при загрузке организаций', () => {
    setup({ currentOrgId: null, organizationsLoading: true });
    // У Mantine Loader нет роли status — проверяем по классу
    expect(document.querySelector('.mantine-Loader-root')).not.toBeNull();
  });

  it('показывает сообщение об отсутствии организаций', () => {
    setup({ currentOrgId: null });
    expect(screen.getByText('Вас не добавили ни в одну организацию.')).toBeInTheDocument();
    expect(
      screen.getByText('Обратитесь к администратору, чтобы получить доступ.'),
    ).toBeInTheDocument();
  });

  it('кнопка «Выйти» вызывает logout', () => {
    const { logout } = setup({ currentOrgId: null });
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('рендерит основной контент при наличии организации', () => {
    setup();
    expect(screen.getByTestId('date-picker')).toBeInTheDocument();
    expect(screen.getByTestId('account-list')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-section')).toBeInTheDocument();
  });
});
