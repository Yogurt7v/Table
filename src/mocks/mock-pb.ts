import { vi } from 'vitest';

let currentUser: Record<string, unknown> | null = null;
let currentToken = '';
const listeners: Array<(...args: unknown[]) => void> = [];

export const authStore = {
  get model() { return currentUser; },
  get token() { return currentToken; },
  get isValid() { return !!currentUser; },
  onChange: vi.fn((cb: (...args: unknown[]) => void, fireImmediately?: boolean) => {
    listeners.push(cb);
    if (fireImmediately) {
      setTimeout(() => { cb(currentToken, currentUser); }, 0);
    }
    return () => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }),
  clear: vi.fn(() => {
    currentUser = null;
    currentToken = '';
    listeners.forEach(cb => { cb('', null); });
  }),
  save: vi.fn((token: string, model: Record<string, unknown>) => {
    currentToken = token;
    currentUser = model;
    listeners.forEach(cb => { cb(token, model); });
  }),
};

export function setAuthUser(user: Record<string, unknown> | null, token?: string) {
  currentUser = user;
  currentToken = token || (user ? 'mock-token' : '');
  listeners.forEach(cb => { cb(currentToken, currentUser); });
}

export function resetAuth() {
  currentUser = null;
  currentToken = '';
}

export function createMockPbModule(authUser?: Record<string, unknown> | null) {
  if (authUser) setAuthUser(authUser);
  else resetAuth();

  return {
    pb: {
      authStore,
      files: {
        getUrl: () => '/mock-file.pdf',
      },
      collection: (name: string) => ({
        getFullList: async (options?: Record<string, unknown>) => {
          const params = new URLSearchParams();
          if (options?.filter) params.set('filter', options.filter as string);
          if (options?.sort) params.set('sort', options.sort as string);
          const url = `http://127.0.0.1:8090/api/collections/${name}/records?${params}`;
          const res = await fetch(url);
          const data = await res.json() as { items: unknown[] };
          return data.items;
        },
        getList: async (page: number, perPage: number, options?: Record<string, unknown>) => {
          const params = new URLSearchParams();
          params.set('page', String(page));
          params.set('perPage', String(perPage));
          if (options?.filter) params.set('filter', options.filter as string);
          if (options?.sort) params.set('sort', options.sort as string);
          if (options?.fields) params.set('fields', options.fields as string);
          const url = `http://127.0.0.1:8090/api/collections/${name}/records?${params}`;
          const res = await fetch(url);
          return res.json();
        },
        getOne: async (id: string) => {
          const url = `http://127.0.0.1:8090/api/collections/${name}/records/${id}`;
          const res = await fetch(url);
          return res.json();
        },
        getFirstListItem: async (filter: string) => {
          const url = `http://127.0.0.1:8090/api/collections/${name}/records?filter=${encodeURIComponent(filter)}&perPage=1`;
          const res = await fetch(url);
          const data = await res.json() as { items: unknown[] };
          return data.items[0];
        },
        create: async (data: unknown) => {
          const url = `http://127.0.0.1:8090/api/collections/${name}/records`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          return res.json();
        },
        update: async (id: string, data: unknown) => {
          const url = `http://127.0.0.1:8090/api/collections/${name}/records/${id}`;
          const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          return res.json();
        },
        delete: async (id: string) => {
          const url = `http://127.0.0.1:8090/api/collections/${name}/records/${id}`;
          const res = await fetch(url, { method: 'DELETE' });
          if (!res.ok) throw new Error('Delete failed');
          return true;
        },
        authWithPassword: async (login: string, password: string) => {
          const url = 'http://127.0.0.1:8090/api/collections/users/auth-with-password';
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: login, password }),
          });
          const data = await res.json() as { token: string; record: Record<string, unknown>; message?: string };
          if (!res.ok) throw new Error((data as { message?: string }).message || 'Auth failed');
          authStore.save(data.token, data.record);
          return data;
        },
        subscribe: () => () => {},
        unsubscribe: () => {},
      }),
    },
  };
}
