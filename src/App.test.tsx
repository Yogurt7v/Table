import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthContext } from '@/shared/context/AuthContext';
import { OrgContext } from '@/shared/context/OrgContext';
import { SearchContext } from '@/shared/context/SearchContext';
import { InvoiceNavigationContext } from '@/shared/context/InvoiceNavigationContext';
import type { AuthContextValue } from '@/shared/context/AuthContext';
import type { OrgContextValue } from '@/shared/context/OrgContext';
import type { SearchContextValue } from '@/shared/context/SearchContext';
import type { InvoiceNavigationContextValue } from '@/shared/context/InvoiceNavigationContext';

const theme = createTheme({});

function renderApp(route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const authValue: AuthContextValue = {
    user: { id: 'u1', email: 'test@test.com', name: 'Test' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  };

  const orgValue: OrgContextValue = {
    currentOrgId: 'org1',
    currentOrg: { id: 'org1', name: 'Test Org' },
    organizations: [],
    organizationsLoading: false,
  };

  const searchValue: SearchContextValue = {
    searchText: '',
    searchAll: false,
    setSearchText: vi.fn(),
    setSearchAll: vi.fn(),
  };

  const navValue: InvoiceNavigationContextValue = {
    selectedDate: new Date(),
    setSelectedDate: vi.fn(),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <AuthContext.Provider value={authValue}>
          <OrgContext.Provider value={orgValue}>
            <SearchContext.Provider value={searchValue}>
              <InvoiceNavigationContext.Provider value={navValue}>
                <MemoryRouter initialEntries={[route]}>
                  <App />
                </MemoryRouter>
              </InvoiceNavigationContext.Provider>
            </SearchContext.Provider>
          </OrgContext.Provider>
        </AuthContext.Provider>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  it('рендерит страницу логина по /login', () => {
    renderApp('/login');
    expect(screen.getByText(/Вход|Логин|Email|Пароль/i)).toBeInTheDocument();
  });

  it('неавторизованный пользователь перенаправляется на /login', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const authValue: AuthContextValue = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={theme}>
          <AuthContext.Provider value={authValue}>
            <OrgContext.Provider value={{ currentOrgId: null, currentOrg: null, organizations: [], organizationsLoading: false }}>
              <SearchContext.Provider value={{ searchText: '', searchAll: false, setSearchText: vi.fn(), setSearchAll: vi.fn() }}>
                <InvoiceNavigationContext.Provider value={{ selectedDate: new Date(), setSelectedDate: vi.fn() }}>
                  <MemoryRouter initialEntries={['/']}>
                    <App />
                  </MemoryRouter>
                </InvoiceNavigationContext.Provider>
              </SearchContext.Provider>
            </OrgContext.Provider>
          </AuthContext.Provider>
        </MantineProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Вход|Логин|Email|Пароль/i)).toBeInTheDocument();
  });

  it('неизвестный маршрут перенаправляет на /', () => {
    renderApp('/unknown-route');
    // После редиректа на / должна быть главная страница
    expect(screen.getByText(/Счета|Реестр|Организация/i)).toBeInTheDocument();
  });
});
