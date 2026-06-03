import { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface ProvidersOptions {
  initialEntries?: string[];
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options?: ProvidersOptions & Omit<RenderOptions, 'wrapper'>,
) {
  const { initialEntries = ['/'], ...renderOptions } = options ?? {};
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MantineProvider defaultColorScheme="light">
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </MantineProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

export function createMockAuthStore(user: Record<string, unknown> | null = null) {
  const listeners: Array<(...args: unknown[]) => void> = [];
  let currentUser = user;
  let currentToken = user ? 'mock-token' : '';

  return {
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
}

export function createMockApiModule() {
  const authStore = createMockAuthStore();

  function createCollectionMock(name: string) {
    return {
      getFullList: async () => {
        const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records`);
        if (!res.ok) return [];
        const data = await res.json() as { items: unknown[] };
        return data.items;
      },
      getList: async (page = 1, perPage = 50, options?: Record<string, unknown>) => {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('perPage', String(perPage));
        if (options?.filter) params.set('filter', options.filter as string);
        const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records?${params}`);
        return res.json();
      },
      getOne: async (id: string) => {
        const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records/${id}`);
        return res.json();
      },
      getFirstListItem: async (filter: string) => {
        const res = await fetch(`http://127.0.0.1:8090/api/collections/${name}/records?filter=${encodeURIComponent(filter)}&perPage=1`);
        const data = await res.json() as { items: unknown[] };
        if (!data.items?.length) throw { status: 404, message: 'Not found.' };
        return data.items[0];
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
    };
  }

  return {
    pb: {
      authStore,
      files: { getUrl: () => '/mock-file.pdf' },
      collection: (name: string) => createCollectionMock(name),
    },
  };
}
