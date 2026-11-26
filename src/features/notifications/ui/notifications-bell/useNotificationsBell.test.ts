import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import type { INotification } from '@/shared/types';
import { useNotificationsBell } from './useNotificationsBell';

const navigate = vi.fn();
const setCurrentOrgId = vi.fn();
const requestHighlight = vi.fn();
const requestHighlightWithCandidates = vi.fn();
const getInvoice = vi.fn();
const getDeletedInvoiceByOriginalId = vi.fn();
const getQueryData = vi.fn();

let currentOrgId = 'org1';
let selectedDate = new Date('2026-05-20T12:00:00Z');
let notifications: INotification[] = [];

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ getQueryData }),
}));

vi.mock('@/shared/context/OrgContext', () => ({
  useOrg: () => ({ currentOrgId, setCurrentOrgId }),
}));

vi.mock('@/shared/context/InvoiceNavigationContext', () => ({
  useInvoiceNavigation: () => ({
    selectedDate,
    requestHighlight,
    requestHighlightWithCandidates,
  }),
}));

vi.mock('@/shared/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications,
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    unreadCount: 0,
    error: null,
    retryNow: vi.fn(),
    loadMore: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  }),
  useNotificationsByDate: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/api/collections', () => ({
  getInvoice: (...args: unknown[]) => getInvoice(...args),
  getDeletedInvoiceByOriginalId: (...args: unknown[]) => getDeletedInvoiceByOriginalId(...args),
}));

function makeNotification(overrides: Partial<INotification> = {}): INotification {
  return {
    id: 'n1',
    organization_id: 'org1',
    user_id: 'u1',
    invoice_id: 'inv1',
    type: 'invoice_created',
    event: 'Создан счёт',
    message: 'Создан счёт',
    actor_name: 'Admin',
    read: false,
    created: '2026-05-20T10:00:00Z',
    ...overrides,
  } as INotification;
}

describe('useNotificationsBell.handleNavigate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentOrgId = 'org1';
    selectedDate = new Date('2026-05-20T12:00:00Z');
    notifications = [];
    getQueryData.mockReturnValue([]);
  });

  it('navigates to docs for document notification and switches org', () => {
    currentOrgId = 'org2';
    const { result } = renderHook(() => useNotificationsBell());
    act(() => result.current.open());

    act(() => {
      result.current.handleNavigate(
        makeNotification({ document_id: 'doc1', invoice_id: '', organization_id: 'org1' }),
      );
    });

    expect(setCurrentOrgId).toHaveBeenCalledWith('org1');
    expect(navigate).toHaveBeenCalledWith('/docs', { state: { documentId: 'doc1' } });
    expect(result.current.opened).toBe(false);
  });

  it('navigates to archive with highlight for deleted invoice', async () => {
    getDeletedInvoiceByOriginalId.mockResolvedValue({ id: 'del1' });
    const { result } = renderHook(() => useNotificationsBell());

    act(() => {
      result.current.handleNavigate(
        makeNotification({ type: 'invoice_deleted', invoice_id: 'inv1', organization_id: 'org1' }),
      );
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/admin?tab=archive&highlight=del1');
    });
  });

  it('falls back to archive without highlight when deleted invoice lookup fails or org missing', async () => {
    getDeletedInvoiceByOriginalId.mockRejectedValue(new Error('not found'));
    const { result } = renderHook(() => useNotificationsBell());

    act(() => {
      result.current.handleNavigate(
        makeNotification({ type: 'invoice_deleted', invoice_id: 'inv1', organization_id: 'org1' }),
      );
    });
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/admin?tab=archive');
    });

    navigate.mockClear();
    act(() => {
      result.current.handleNavigate(
        makeNotification({ type: 'invoice_deleted', invoice_id: 'inv2', organization_id: '' }),
      );
    });
    expect(navigate).toHaveBeenCalledWith('/admin?tab=archive');
  });

  it('highlights invoice in current day without date change', async () => {
    getInvoice.mockResolvedValue({ id: 'inv1', date: '2026-05-20' });
    getQueryData.mockReturnValue([{ id: 'inv1' }]);
    const { result } = renderHook(() => useNotificationsBell());

    act(() => {
      result.current.handleNavigate(makeNotification());
    });

    await waitFor(() => {
      expect(requestHighlight).toHaveBeenCalledWith('inv1', selectedDate);
    });
    expect(navigate).toHaveBeenCalledWith('/');
    expect(requestHighlightWithCandidates).not.toHaveBeenCalled();
  });

  it('uses candidate dates for old notification and single candidate for same day', async () => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    getInvoice.mockResolvedValue({ id: 'inv1', date: '2026-04-01' });
    getQueryData.mockReturnValue([]);
    const { result } = renderHook(() => useNotificationsBell());

    act(() => {
      result.current.handleNavigate(
        makeNotification({ created: '2026-04-02T10:00:00Z', invoice_id: 'inv1' }),
      );
    });
    await waitFor(() => {
      expect(requestHighlightWithCandidates).toHaveBeenCalledWith('inv1', ['2026-04-02', '2026-04-01']);
    });

    requestHighlight.mockClear();
    requestHighlightWithCandidates.mockClear();
    getInvoice.mockResolvedValue({ id: 'inv2', date: todayStr });
    act(() => {
      result.current.handleNavigate(
        makeNotification({ id: 'n2', invoice_id: 'inv2', created: `${todayStr}T10:00:00Z` }),
      );
    });
    await waitFor(() => {
      expect(requestHighlight).toHaveBeenCalled();
    });
    expect(requestHighlightWithCandidates).not.toHaveBeenCalled();
  });

  it('falls back on invoice fetch error', async () => {
    getInvoice.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useNotificationsBell());

    act(() => {
      result.current.handleNavigate(makeNotification());
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/');
      expect(requestHighlight).toHaveBeenCalledWith('', expect.any(Date));
    });
  });
});
