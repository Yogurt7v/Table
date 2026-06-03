import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { NotificationsBell } from './NotificationsBell';
import type { INotification } from '@/shared/types';

const mockHooks = vi.hoisted(() => {
  let mockNotifications: INotification[] = [];
  let mockLoading = false;
  let mockUnreadCount = 0;

  return {
    setNotifications: (items: INotification[], unread: number) => {
      mockNotifications = items;
      mockUnreadCount = unread;
    },
    setLoading: (v: boolean) => { mockLoading = v; },
    useAuth: () => ({ user: { id: 'user1', login: 'admin' }, isAuthenticated: true, isLoading: false }),
    useNotifications: () => ({
      notifications: mockNotifications,
      isLoading: mockLoading,
      unreadCount: mockUnreadCount,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
    }),
  };
});

vi.mock('@/shared/context/AuthContext', () => ({
  useAuth: mockHooks.useAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/shared/hooks/useNotifications', () => ({
  useNotifications: mockHooks.useNotifications,
}));

vi.mock('@/api/client', () => ({}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function renderBell() {
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider defaultColorScheme="light">
        <MemoryRouter>
          <NotificationsBell />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('NotificationsBell', () => {
  beforeEach(() => {
    mockHooks.setNotifications([], 0);
    mockHooks.setLoading(false);
  });

  it('renders bell icon', () => {
    renderBell();
    const bell = document.querySelector('button');
    expect(bell).toBeInTheDocument();
  });

  it('opens drawer on bell click', async () => {
    const user = userEvent.setup();
    renderBell();

    const bell = document.querySelector('button')!;
    await user.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Уведомления')).toBeInTheDocument();
    });
  });

  it('shows notification items in drawer', async () => {
    const user = userEvent.setup();
    mockHooks.setNotifications(
      [
        {
          id: 'n1', organization_id: 'org1', user_id: 'user1',
          invoice_id: 'inv1', type: 'invoice_created', event: 'created',
          message: 'Создан счёт №1', actor_name: 'Админ',
          read: false, created: '2026-06-02T10:00:00Z',
        } as INotification,
      ],
      1,
    );
    renderBell();

    const bell = document.querySelector('button')!;
    await user.click(bell);

    await waitFor(() => {
      expect(screen.getByText('created')).toBeInTheDocument();
    });

    expect(screen.getByText('Админ')).toBeInTheDocument();
  });
});
