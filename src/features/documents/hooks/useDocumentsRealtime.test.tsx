import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { invalidateDocumentsCache, useDocumentsRealtime } from './useDocumentsRealtime';

type Listener = (event: unknown) => void;

interface Subscription {
  collection: string;
  listener: Listener;
  filter?: string;
  unsubscribe: Mock<() => Promise<void>>;
}

const h = vi.hoisted(() => ({
  subscriptions: [] as Subscription[],
}));

vi.mock('@/api/client', () => ({
  pb: {
    collection: (name: string) => ({
      subscribe: (_topic: string, listener: Listener, options?: { filter?: string }) => {
        const unsubscribe = vi.fn(async () => {});
        h.subscriptions.push({ collection: name, listener, filter: options?.filter, unsubscribe });
        return Promise.resolve(unsubscribe);
      },
    }),
  },
}));

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

/** Даёт резолвнуться всем subscribe()-промисам и их продолжениям. */
async function flushSubscriptions(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const DOCUMENT_QUERY_KEYS = [
  ['documents', 'org1', 'admin', 'u1'],
  ['documents-archive', 'org1'],
  ['document-files-all', 'org1'],
  ['document-comments-all', 'org1'],
  ['document-comment-search', 'org1', 'договор'],
  ['document', 'doc1'],
  ['document-files', 'doc1'],
  ['document-comments', 'doc1'],
  ['document-history', 'doc1'],
];

beforeEach(() => {
  h.subscriptions.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDocumentsRealtime', () => {
  it('subscribes to every document collection with the organization filter', async () => {
    const queryClient = makeQueryClient();
    renderHook(() => useDocumentsRealtime('org1'), { wrapper: wrapper(queryClient) });
    await flushSubscriptions();

    expect(h.subscriptions.map((s) => s.collection).sort()).toEqual([
      'document_comments',
      'document_files',
      'document_history',
      'documents',
    ]);
    for (const subscription of h.subscriptions) {
      expect(subscription.filter).toBe('organization_id = "org1"');
    }
  });

  it('does not subscribe without an organization or when disabled', async () => {
    const queryClient = makeQueryClient();
    const { rerender } = renderHook(
      ({ org, enabled }: { org: string; enabled: boolean }) => useDocumentsRealtime(org, enabled),
      {
        initialProps: { org: '', enabled: true },
        wrapper: wrapper(queryClient),
      },
    );
    await flushSubscriptions();
    expect(h.subscriptions).toHaveLength(0);

    rerender({ org: 'org1', enabled: false });
    await flushSubscriptions();
    expect(h.subscriptions).toHaveLength(0);
  });

  it('a remote change invalidates the whole documents cache after the batch window', async () => {
    vi.useFakeTimers();
    const queryClient = makeQueryClient();
    for (const key of DOCUMENT_QUERY_KEYS) queryClient.setQueryData(key, []);

    renderHook(() => useDocumentsRealtime('org1'), { wrapper: wrapper(queryClient) });
    await flushSubscriptions();

    act(() => {
      h.subscriptions[0]?.listener({ action: 'update', record: { id: 'doc1' } });
    });
    // Событие ещё не должно сбрасывать кэш до истечения окна пакетирования.
    expect(queryClient.getQueryState(DOCUMENT_QUERY_KEYS[0]!)?.isInvalidated).toBe(false);

    act(() => {
      vi.advanceTimersByTime(250);
    });

    for (const key of DOCUMENT_QUERY_KEYS) {
      expect(queryClient.getQueryState(key)?.isInvalidated, String(key)).toBe(true);
    }
  });

  it('coalesces a burst of events into a single cache reset', async () => {
    vi.useFakeTimers();
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useDocumentsRealtime('org1'), { wrapper: wrapper(queryClient) });
    await flushSubscriptions();

    act(() => {
      for (let i = 0; i < 5; i += 1) {
        h.subscriptions[0]?.listener({ action: 'update', record: { id: 'doc1' } });
      }
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from every collection and drops a pending reset on unmount', async () => {
    vi.useFakeTimers();
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { unmount } = renderHook(() => useDocumentsRealtime('org1'), {
      wrapper: wrapper(queryClient),
    });
    await flushSubscriptions();

    act(() => {
      h.subscriptions[0]?.listener({ action: 'create', record: { id: 'doc2' } });
    });
    unmount();

    for (const subscription of h.subscriptions) {
      expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    }

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('invalidateDocumentsCache', () => {
  it('leaves queries outside the documents domain untouched', () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(['invoices', 'org1'], []);
    queryClient.setQueryData(['documents', 'org1', 'admin', 'u1'], []);

    invalidateDocumentsCache(queryClient);

    expect(queryClient.getQueryState(['invoices', 'org1'])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(['documents', 'org1', 'admin', 'u1'])?.isInvalidated).toBe(
      true,
    );
  });
});
