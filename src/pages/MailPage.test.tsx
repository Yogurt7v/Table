import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MailPage } from './MailPage';
import { AuthContext } from '@/shared/context/AuthContext';
import { OrgContext } from '@/shared/context/OrgContext';
import { SearchContext } from '@/shared/context/SearchContext';
import { InvoiceNavigationContext } from '@/shared/context/InvoiceNavigationContext';
import { DatePinnedContext } from '@/shared/context/DatePinnedContext';
import type { AuthContextValue } from '@/shared/context/AuthContext';
import type { OrgContextValue } from '@/shared/context/OrgContext';
import type { SearchContextValue } from '@/shared/context/SearchContext';
import type { InvoiceNavigationContextValue } from '@/shared/context/InvoiceNavigationContext';
import type { DatePinnedContextValue } from '@/shared/context/DatePinnedContext';

const theme = createTheme({});

function renderWithProviders(
  ui: React.ReactNode,
  overrides: {
    auth?: Partial<AuthContextValue>;
    org?: Partial<OrgContextValue>;
    search?: Partial<SearchContextValue>;
    nav?: Partial<InvoiceNavigationContextValue>;
    pinned?: Partial<DatePinnedContextValue>;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const authValue: AuthContextValue = {
    user: { id: 'u1', email: 'test@test.com', name: 'Test' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides.auth,
  };

  const orgValue: OrgContextValue = {
    currentOrgId: 'org1',
    currentOrg: { id: 'org1', name: 'Test Org' },
    organizations: [],
    organizationsLoading: false,
    ...overrides.org,
  };

  const searchValue: SearchContextValue = {
    searchText: '',
    searchAll: false,
    setSearchText: vi.fn(),
    setSearchAll: vi.fn(),
    ...overrides.search,
  };

  const navValue: InvoiceNavigationContextValue = {
    selectedDate: new Date('2024-01-15'),
    setSelectedDate: vi.fn(),
    ...overrides.nav,
  };

  const pinnedValue: DatePinnedContextValue = {
    pinned: false,
    registerAnchor: vi.fn(),
    ...overrides.pinned,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <AuthContext.Provider value={authValue}>
          <OrgContext.Provider value={orgValue}>
            <SearchContext.Provider value={searchValue}>
              <InvoiceNavigationContext.Provider value={navValue}>
                <DatePinnedContext.Provider value={pinnedValue}>
                  {ui}
                </DatePinnedContext.Provider>
              </InvoiceNavigationContext.Provider>
            </SearchContext.Provider>
          </OrgContext.Provider>
        </AuthContext.Provider>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

// Mock useMailPermissions и useOrganizationUsers
vi.mock('@/shared/hooks/useMailPermissions', () => ({
  useMailPermissions: vi.fn(() => ({
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    isLoading: false,
  })),
}));

vi.mock('@/shared/hooks/useOrganizationUsers', () => ({
  useOrganizationUsers: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
}));

// Mock MailSection
vi.mock('@/features/mail/MailSection', () => ({
  MailSection: () => <div data-testid="mail-section">MailSection</div>,
}));

describe('MailPage', () => {
  it('показывает Loader при загрузке организаций', () => {
    renderWithProviders(<MailPage />, {
      org: { currentOrgId: null, organizationsLoading: true },
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('возвращает null при отсутствии прав', () => {
    vi.doMock('@/shared/hooks/useMailPermissions', () => ({
      useMailPermissions: vi.fn(() => ({
        canView: false,
        isLoading: false,
      })),
    }));

    renderWithProviders(<MailPage />, {
      org: { currentOrgId: 'org1', organizationsLoading: false },
    });
    expect(screen.queryByTestId('mail-section')).not.toBeInTheDocument();

    vi.doUnmock('@/shared/hooks/useMailPermissions');
  });

  it('рендерит MailSection при наличии прав', () => {
    renderWithProviders(<MailPage />);
    expect(screen.getByTestId('mail-section')).toBeInTheDocument();
  });
});
