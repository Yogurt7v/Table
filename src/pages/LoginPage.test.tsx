import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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
      collection: (name: string) => ({
        getFullList: async () => {
          const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records`);
          const data = await res.json() as { items: unknown[] };
          return data.items;
        },
        getList: async (page = 1, perPage = 50) => {
          const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records?page=${page}&perPage=${perPage}`);
          return res.json();
        },
        getOne: async (id: string) => {
          const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records/${id}`);
          return res.json();
        },
        getFirstListItem: async (filter: string) => {
          const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records?filter=${encodeURIComponent(filter)}&perPage=1`);
          const data = await res.json() as { items: unknown[] };
          return data.items?.[0];
        },
        create: async (data: unknown) => {
          const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          return res.json();
        },
        update: async (id: string, data: unknown) => {
          const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          return res.json();
        },
        delete: async (id: string) => {
          const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records/${id}`, { method: 'DELETE' });
          return res.ok;
        },
        authWithPassword: async (login: string, password: string) => {
          const res = await fetch('http://127.0.0.1:8090/api/collections/users/auth-with-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: login, password }),
          });
          const data = await res.json() as { token: string; record: Record<string, unknown>; message?: string };
          if (!res.ok) throw new Error(data.message || 'Auth failed');
          authStore.save(data.token, data.record);
          return data;
        },
        subscribe: () => () => {},
        unsubscribe: () => {},
      }),
    },
  };
});

vi.mock('@/api/client', () => mockApi);

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function renderLoginPage() {
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider defaultColorScheme="light">
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<div>Home page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockApi.pb.authStore.clear();
  });

  it('renders login form with title and fields', async () => {
    renderLoginPage();
    await waitFor(() => {
      expect(screen.getByText('Реестры счетов')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Ваш логин')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ваш пароль')).toBeInTheDocument();
  });

  it('shows error message on failed login', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ваш логин')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Ваш логин'), 'admin');
    await user.type(screen.getByPlaceholderText('Ваш пароль'), 'wrong_password');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(screen.getByText('Неверный логин или пароль')).toBeInTheDocument();
    });
  });

  it('navigates away on successful login', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ваш логин')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Ваш логин'), 'admin');
    await user.type(screen.getByPlaceholderText('Ваш пароль'), 'test123');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(screen.getByText('Home page')).toBeInTheDocument();
    });
  });
});
