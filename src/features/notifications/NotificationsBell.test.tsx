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
  let mockHasMore = false;
  const mockLoadMore = vi.fn();
  const mockIsLoadingMore = false;

  return {
    setNotifications: (items: INotification[], unread: number) => {
      mockNotifications = items;
      mockUnreadCount = unread;
    },
    setLoading: (v: boolean) => { mockLoading = v; },
    setHasMore: (v: boolean) => { mockHasMore = v; },
    loadMore: mockLoadMore,
    useAuth: () => ({ user: { id: 'user1', login: 'admin' }, isAuthenticated: true, isLoading: false }),
    useNotifications: () => ({
      notifications: mockNotifications,
      isLoading: mockLoading,
      isLoadingMore: mockIsLoadingMore,
      hasMore: mockHasMore,
      unreadCount: mockUnreadCount,
      loadMore: mockLoadMore,
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
  useNotificationsByDate: () => ({ data: undefined as INotification[] | undefined, isLoading: false }),
}));

vi.mock('@/shared/context/OrgContext', () => ({
  useOrg: () => ({ currentOrgId: 'org1', setCurrentOrgId: vi.fn() }),
}));

vi.mock('@/shared/context/InvoiceNavigationContext', () => ({
  useInvoiceNavigation: () => ({
    selectedDate: new Date(),
    setSelectedDate: vi.fn(),
    highlightedInvoiceId: null,
    highlightRequestId: 0,
    requestHighlight: vi.fn(),
  }),
}));

vi.mock('@/api/collections', () => ({
  getInvoice: vi.fn(() => Promise.resolve({ id: 'inv1', date: '2026-06-02' })),
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
    mockHooks.setHasMore(false);
    mockHooks.loadMore.mockClear();
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

  it('keeps read notifications in the list together with unread', async () => {
    const user = userEvent.setup();
    mockHooks.setNotifications(
      [
        {
          id: 'n1', organization_id: 'org1', user_id: 'user1', invoice_id: 'inv1',
          type: 'invoice_created', event: 'Создан счёт', message: 'Создан счёт',
          actor_name: 'Админ', read: false, created: '2026-06-02T10:00:00Z',
        } as INotification,
        {
          id: 'n2', organization_id: 'org1', user_id: 'user1', invoice_id: 'inv2',
          type: 'payment_marked', event: 'Счёт оплачен', message: 'Счёт оплачен',
          actor_name: 'Модератор', read: true, created: '2026-06-02T11:00:00Z',
        } as INotification,
      ],
      1,
    );
    renderBell();

    const bell = document.querySelector('button')!;
    await user.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Создан счёт')).toBeInTheDocument();
    });
    expect(screen.getByText('Счёт оплачен')).toBeInTheDocument();
    expect(screen.getByText('Модератор')).toBeInTheDocument();
  });

  it('shows «Показать ещё» and calls loadMore on click', async () => {
    const user = userEvent.setup();
    mockHooks.setNotifications(
      [
        {
          id: 'n1', organization_id: 'org1', user_id: 'user1', invoice_id: 'inv1',
          type: 'invoice_created', event: 'Создан счёт', message: 'Создан счёт',
          actor_name: 'Админ', read: false, created: '2026-06-02T10:00:00Z',
        } as INotification,
      ],
      1,
    );
    mockHooks.setHasMore(true);
    renderBell();

    const bell = document.querySelector('button')!;
    await user.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Создан счёт')).toBeInTheDocument();
    });

    const moreButton = screen.getByRole('button', { name: 'Показать ещё' });
    await user.click(moreButton);

    expect(mockHooks.loadMore).toHaveBeenCalledTimes(1);
  });

  it('renders invoice_deleted notification with deleter name in event', async () => {
    const user = userEvent.setup();
    mockHooks.setNotifications(
      [
        {
          id: 'n1', organization_id: 'org1', user_id: 'user1', invoice_id: 'inv1',
          type: 'invoice_deleted', event: 'Счёт удалён: ООО Ромашка, 5000 ₽ · Пётр',
          message: 'Счёт удалён: ООО Ромашка, 5000 ₽\nУдалил(а): Пётр',
          actor_name: 'Пётр', object_name: 'Основной', read: false,
          created: '2026-06-02T10:00:00Z',
        } as INotification,
      ],
      1,
    );
    renderBell();

    const bell = document.querySelector('button')!;
    await user.click(bell);

    await waitFor(() => {
      expect(
        screen.getByText('Счёт удалён: ООО Ромашка, 5000 ₽ · Пётр'),
      ).toBeInTheDocument();
    });
    expect(screen.getAllByText('Пётр').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Подробнее' }));
    expect(screen.getByText(/Удалил\(а\): Пётр/)).toBeInTheDocument();
  });
});
