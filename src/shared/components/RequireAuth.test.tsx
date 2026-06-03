import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { render } from '@testing-library/react';
import { RequireAuth } from './RequireAuth';
import { AuthProvider } from '@/shared/context/AuthContext';

const mockApi = vi.hoisted(() => {
  const listeners: Array<(...args: unknown[]) => void> = [];
  let currentUser: Record<string, unknown> | null = null;
  let currentToken = '';

  const authStore = {
    get model() { return currentUser; },
    get token() { return currentToken; },
    get isValid() { return !!currentUser; },
    onChange: (cb: (...args: unknown[]) => void, fireImmediately?: boolean) => {
      listeners.push(cb);
      if (fireImmediately) {
        setTimeout(() => { cb(currentToken, currentUser); }, 0);
      }
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
    clear: () => {
      currentUser = null;
      currentToken = '';
      listeners.forEach(cb => { cb('', null); });
    },
    save: (token: string, model: Record<string, unknown>) => {
      currentToken = token;
      currentUser = model;
      listeners.forEach(cb => { cb(token, model); });
    },
  };

  return {
    pb: {
      authStore,
      files: { getUrl: () => '/mock-file.pdf' },
      collection: () => ({
        getFullList: async () => [],
        getList: async () => ({ page: 1, perPage: 50, totalItems: 0, totalPages: 0, items: [] }),
        getOne: async () => ({}),
        getFirstListItem: async () => ({}),
        create: async (d: unknown) => d,
        update: async (_id: string, d: unknown) => d,
        delete: async () => true,
        authWithPassword: async () => ({}),
        subscribe: () => () => {},
        unsubscribe: () => {},
      }),
    },
  };
});

vi.mock('@/api/client', () => mockApi);

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function renderRequireAuth() {
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider defaultColorScheme="light">
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <Routes>
              <Route element={<RequireAuth />}>
                <Route path="/" element={<div data-testid="protected-content">Protected</div>} />
              </Route>
              <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    mockApi.pb.authStore.clear();
  });

  it('renders protected content when authenticated', async () => {
    mockApi.pb.authStore.save('token', { id: 'user1', login: 'admin' });
    renderRequireAuth();

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  it('redirects to /login when not authenticated', async () => {
    renderRequireAuth();

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });
});
