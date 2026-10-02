import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import type { INotification } from '@/shared/types';
import { useNotifications } from './useNotifications';

/**
 * Regression net for the notification incident: the data layer of `useNotifications`.
 *
 * The transport is faked one level below the SDK — `globalThis.fetch` — instead of
 * mocking `@/api/collections`. That is deliberate: the incident was the SDK's
 * auto-cancellation (`requestKey`), which only exists on the real request path, so a
 * module-level mock of the query functions would make the concurrency case vacuously
 * green. With a fake transport the *real* `getNotificationsPage`,
 * `getUnreadNotificationsCount` and `update` run — requestKey and all — while the
 * server stays completely under test control.
 *
 * Only two things are substituted: `useAuth` (needs a referentially stable user) and
 * `pb.realtime.subscribe` (an SSE stream, which cannot be faked deterministically).
 */

type HookResult = ReturnType<typeof useNotifications>;
type RealtimeEvent = { action: 'create' | 'update' | 'delete'; record: INotification };
type RealtimeListener = (event: RealtimeEvent) => void;
type CallKind = 'page' | 'count' | 'write';

interface Fixture {
  items: INotification[];
  totalItems: number;
  unreadTotal: number;
}

const RECORDS_PATH = '/api/collections/notifications/records';

const h = vi.hoisted(() => ({
  // Stable on purpose: a fresh object per render churns `load`'s identity, so the
  // fetch effect re-runs and every refetch resets the list under the assertions.
  user: { id: 'u1', login: 'admin' },
  fixture: { items: [], totalItems: 0, unreadTotal: 0 } as Fixture,
  listeners: [] as RealtimeListener[],
  unsubscribes: [] as Mock<() => Promise<void>>[],
  calls: [] as { kind: CallKind; url: string }[],
  /** >= 400 makes every list read fail with that HTTP status. */
  listStatus: 200,
  /** >= 400 makes every notification write fail with that HTTP status. */
  writeStatus: 200,
  /** Kills the page read the way a dropped connection does, instead of answering it. */
  pageAborts: false,
}));

vi.mock('@/shared/context/AuthContext', () => ({
  useAuth: () => ({ user: h.user, isAuthenticated: true, isLoading: false }),
}));

vi.mock('@/api/client', async () => {
  const { default: PocketBase } = await import('pocketbase');
  const pb = new PocketBase('http://127.0.0.1:8090');
  // A real client so request auto-cancellation stays the SDK's own logic; only the
  // realtime transport is replaced. Every call yields a distinct unsubscribe.
  pb.realtime.subscribe = (_topic: string, callback: RealtimeListener) => {
    h.listeners.push(callback);
    const unsubscribe = vi.fn(async () => {});
    h.unsubscribes.push(unsubscribe);
    return Promise.resolve(unsubscribe);
  };
  return { pb };
});

// --- fake server ---------------------------------------------------------------

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function aborted(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function reply(url: URL, kind: CallKind): Response {
  if (kind === 'write') {
    if (h.writeStatus >= 400) {
      return jsonResponse(h.writeStatus, { code: h.writeStatus, message: 'write failed', data: {} });
    }
    const id = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
    return jsonResponse(200, { ...h.fixture.items.find((n) => n.id === id), id, read: true });
  }
  if (h.pageAborts && kind === 'page') throw aborted();
  if (h.listStatus >= 400) {
    return jsonResponse(h.listStatus, { code: h.listStatus, message: 'list failed', data: {} });
  }
  if (kind === 'count') {
    return jsonResponse(200, {
      page: 1,
      perPage: 1,
      totalPages: 1,
      totalItems: h.fixture.unreadTotal,
      items: [{ id: 'unread' }],
    });
  }
  return jsonResponse(200, {
    page: 1,
    perPage: 20,
    totalPages: 1,
    totalItems: h.fixture.totalItems,
    items: h.fixture.items,
  });
}

async function wire(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : String(input));
  const method = init?.method ?? 'GET';
  if (!url.pathname.startsWith(RECORDS_PATH)) {
    throw new Error(`unexpected request: ${method} ${url.pathname}`);
  }
  const kind: CallKind =
    method === 'PATCH' ? 'write' : url.searchParams.get('fields') === 'id' ? 'count' : 'page';
  h.calls.push({ kind, url: url.href });
  // Yield once so that a concurrent identical request — the SDK's auto-cancel — can
  // abort this one exactly as it would abort a real in-flight request.
  await Promise.resolve();
  if (init?.signal?.aborted) throw aborted();
  return reply(url, kind);
}

const requestCount = (kind: CallKind): number => h.calls.filter((c) => c.kind === kind).length;

// --- fixtures ------------------------------------------------------------------

function notification(id: string, overrides: Partial<INotification> = {}): INotification {
  return {
    id,
    organization_id: 'org1',
    user_id: h.user.id,
    invoice_id: `inv-${id}`,
    type: 'invoice_created',
    event: 'Счёт создан',
    message: `Счёт создан ${id}`,
    actor_name: 'admin',
    read: false,
    // Never parsed by the hook — it renders and pages in server order.
    created: '2026-09-01 10:00:00Z',
    ...overrides,
  };
}

function server(items: INotification[], overrides: Partial<Fixture> = {}): Fixture {
  return { items, totalItems: items.length, unreadTotal: items.length, ...overrides };
}

const ids = (result: HookResult): string[] => result.notifications.map((n) => n.id);

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
}

async function mountBell(fixture: Fixture) {
  h.fixture = fixture;
  const view = renderHook(() => useNotifications());
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
}

/** Two keyed consumers in one tree, so dropping a key really unmounts that instance. */
function renderBells(mounted: readonly string[]) {
  const sink: Record<string, HookResult> = {};
  function Consumer({ id }: { id: string }) {
    sink[id] = useNotifications();
    return null;
  }
  const tree = (next: readonly string[]) =>
    createElement(
      Fragment,
      null,
      ...next.map((id) => createElement(Consumer, { key: id, id })),
    );
  const view = render(tree(mounted));
  return {
    sink,
    keep: (next: readonly string[]) => view.rerender(tree(next)),
  };
}

beforeEach(() => {
  h.fixture = server([]);
  h.listeners.length = 0;
  h.unsubscribes.length = 0;
  h.calls.length = 0;
  h.listStatus = 200;
  h.writeStatus = 200;
  h.pageAborts = false;
  setVisibility('visible');
  vi.stubGlobal('fetch', wire);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('useNotifications', () => {
  it('a failed load surfaces an error and does not render as an empty list', async () => {
    h.fixture = server([notification('n1')]);
    h.listStatus = 503;
    vi.useFakeTimers();

    const { result } = renderHook(() => useNotifications());
    // The faked `subscribe` records the listener synchronously, so no polling here:
    // `waitFor` under fake timers takes over the clock this case needs to advance.
    expect(h.listeners).toHaveLength(1);

    // Rows are already on screen — pushed by the realtime feed — while the very first
    // HTTP load is still failing. A destructive catch would answer this failure with an
    // empty array, which is indistinguishable from "there is nothing here".
    await act(async () => {
      h.listeners[0]?.({ action: 'create', record: notification('n1') });
    });
    expect(ids(result.current)).toEqual(['n1']);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(result.current.error).toContain('HTTP 503');
    expect(ids(result.current)).toEqual(['n1']);
    expect(result.current.isLoading).toBe(false);
    // The whole retry budget is spent before the error is surfaced.
    expect(requestCount('page')).toBe(3);
  });

  it('a failure after a successful load preserves the already-loaded notifications', async () => {
    const { result } = await mountBell(server([notification('n1'), notification('n2')]));
    expect(ids(result.current)).toEqual(['n1', 'n2']);

    h.listStatus = 503;
    vi.useFakeTimers();
    await act(async () => {
      result.current.retryNow();
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(ids(result.current)).toEqual(['n1', 'n2']);
    expect(result.current.error).toContain('HTTP 503');
    expect(result.current.isLoading).toBe(false);
  });

  it('two bells loading at once does not blank either list', async () => {
    h.fixture = server([notification('n1'), notification('n2')]);
    const { sink } = renderBells(['a', 'b']);

    // Both bells issue the identical read in the same tick. With the SDK's requestKey
    // collision left in place the second read cancels the first, and an aborted read
    // never repaints — one of the two bells would stay empty forever.
    await waitFor(() => {
      expect(requestCount('page')).toBe(2);
      expect(sink.a?.notifications).toHaveLength(2);
      expect(sink.b?.notifications).toHaveLength(2);
    });

    expect(ids(sink.a as HookResult)).toEqual(['n1', 'n2']);
    expect(ids(sink.b as HookResult)).toEqual(['n1', 'n2']);
    expect(sink.a?.error).toBeNull();
    expect(sink.b?.error).toBeNull();
  });

  it('a transient failure is retried and recovers', async () => {
    h.listStatus = 503;
    vi.useFakeTimers();

    const { result } = renderHook(() => useNotifications());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    // The first backoff has elapsed and the second attempt is already failing, but
    // retries are still pending — so nothing is reported to the user yet.
    expect(requestCount('page')).toBe(2);
    expect(result.current.error).toBeNull();

    h.fixture = server([notification('n1'), notification('n2')]);
    h.listStatus = 200;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(requestCount('page')).toBe(3);
    expect(result.current.error).toBeNull();
    expect(ids(result.current)).toEqual(['n1', 'n2']);
    expect(result.current.isLoading).toBe(false);
  });

  it('a 401 is not retried', async () => {
    h.listStatus = 401;
    vi.useFakeTimers();

    const { result } = renderHook(() => useNotifications());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    // The client has already cleared the auth store and is redirecting to /login,
    // so a second attempt would only delay the redirect.
    expect(requestCount('page')).toBe(1);
    expect(result.current.error).toContain('HTTP 401');
    expect(result.current.isLoading).toBe(false);
  });

  it('refetches when the tab becomes visible', async () => {
    const { result } = await mountBell(server([notification('n1')]));

    h.fixture = server([notification('n1'), notification('n2')]);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(ids(result.current)).toEqual(['n1', 'n2']));
    expect(requestCount('page')).toBe(2);
  });

  it('refetches when connectivity returns', async () => {
    const { result } = await mountBell(server([notification('n1')]));

    h.fixture = server([notification('n1'), notification('n2')]);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(ids(result.current)).toEqual(['n1', 'n2']));
    expect(requestCount('page')).toBe(2);
  });

  it('an aborted request is not reported as an error', async () => {
    const { result } = await mountBell(server([notification('n1'), notification('n2')]));

    h.pageAborts = true;
    await act(async () => {
      result.current.retryNow();
    });

    // The re-check happened and was dropped mid-flight: silence, and the list that was
    // already on screen survives untouched.
    await waitFor(() => expect(requestCount('page')).toBe(2));
    expect(result.current.error).toBeNull();
    expect(ids(result.current)).toEqual(['n1', 'n2']);
  });

  it('a realtime create prepends to the list', async () => {
    const { result } = await mountBell(server([notification('n1'), notification('n2')]));
    await waitFor(() => expect(h.listeners).toHaveLength(1));

    await act(async () => {
      h.listeners[0]?.({ action: 'create', record: notification('n3') });
    });

    expect(ids(result.current)).toEqual(['n3', 'n1', 'n2']);
    expect(result.current.newNotification?.id).toBe('n3');
  });

  it('a realtime update replaces the matching record', async () => {
    const { result } = await mountBell(server([notification('n1'), notification('n2')]));
    await waitFor(() => expect(h.listeners).toHaveLength(1));

    await act(async () => {
      h.listeners[0]?.({
        action: 'update',
        record: notification('n1', { message: 'Счёт изменён', read: true }),
      });
    });

    expect(result.current.notifications.map((n) => n.message)).toEqual([
      'Счёт изменён',
      'Счёт создан n2',
    ]);
    expect(result.current.notifications.map((n) => n.read)).toEqual([true, false]);
  });

  it('a realtime delete removes the matching record', async () => {
    const { result } = await mountBell(server([notification('n1'), notification('n2')]));
    await waitFor(() => expect(h.listeners).toHaveLength(1));

    await act(async () => {
      h.listeners[0]?.({ action: 'delete', record: notification('n1') });
    });

    expect(ids(result.current)).toEqual(['n2']);
  });

  it("unmounting one of two bells leaves the other's realtime feed working", async () => {
    h.fixture = server([notification('n1')]);
    const { sink, keep } = renderBells(['a', 'b']);

    await waitFor(() => {
      expect(sink.a?.notifications).toHaveLength(1);
      expect(sink.b?.notifications).toHaveLength(1);
    });
    await waitFor(() => expect(h.unsubscribes).toHaveLength(2));

    // Pin each subscription's owner empirically rather than trusting mount order: a
    // create on one listener must move its own consumer's list, and only that list.
    await act(async () => {
      h.listeners[0]?.({ action: 'create', record: notification('n2') });
    });
    expect(ids(sink.a as HookResult)).toEqual(['n2', 'n1']);
    expect(ids(sink.b as HookResult)).toEqual(['n1']);

    await act(async () => {
      h.listeners[1]?.({ action: 'create', record: notification('n3') });
    });
    expect(ids(sink.b as HookResult)).toEqual(['n3', 'n1']);
    expect(ids(sink.a as HookResult)).toEqual(['n2', 'n1']);

    keep(['b']);

    // `subscribe` records the listener and its unsubscribe in the same call, so
    // listeners[0] and unsubscribes[0] are one subscription — the one just pinned to
    // 'a'. Releasing it and leaving [1] alone is exactly per-instance cleanup.
    await waitFor(() => expect(h.unsubscribes[0]).toHaveBeenCalledTimes(1));
    expect(h.unsubscribes[1]).not.toHaveBeenCalled();
    // ...and the survivor's feed still feeds the survivor.
    await act(async () => {
      h.listeners[1]?.({ action: 'create', record: notification('n4') });
    });

    expect(ids(sink.b as HookResult)).toEqual(['n4', 'n3', 'n1']);
  });

  it('badge count comes from the server total, not the loaded page', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => notification(`n${i + 1}`));
    const { result } = await mountBell(server(rows, { totalItems: 20, unreadTotal: 25 }));

    expect(result.current.notifications).toHaveLength(20);
    expect(result.current.unreadCount).toBe(25);
  });

  it('both bells get the true unread count when a page is only partially loaded', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => notification(`n${i + 1}`));
    h.fixture = server(rows, { totalItems: 20, unreadTotal: 25 });
    const { sink } = renderBells(['a', 'b']);

    // Both bells register the count read on the same request path in the same tick, so
    // the SDK's auto-cancel hands the loser an abort — and the per-arm `.catch(() => null)`
    // swallows it, pinning that bell to the page-capped fallback of 20.
    await waitFor(() => {
      expect(sink.a?.notifications).toHaveLength(20);
      expect(sink.b?.notifications).toHaveLength(20);
      expect(sink.a?.unreadCount).toBe(25);
      expect(sink.b?.unreadCount).toBe(25);
    });
  });

  it('marking one read decrements the badge immediately', async () => {
    const rows = [notification('n1'), notification('n2')];
    const { result } = await mountBell(server(rows, { totalItems: 2, unreadTotal: 25 }));
    expect(result.current.unreadCount).toBe(25);

    await act(async () => {
      result.current.markAsRead('n1');
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(24));
    expect(result.current.notifications.map((n) => n.read)).toEqual([true, false]);
    // The decrement is local bookkeeping: nothing is re-read from the server.
    expect(requestCount('page')).toBe(1);
  });

  it('mark all read decrements the badge by exactly the number marked', async () => {
    const rows = [
      notification('n1'),
      notification('n2'),
      notification('n3'),
      notification('n4', { read: true }),
    ];
    const { result } = await mountBell(server(rows, { totalItems: 4, unreadTotal: 25 }));

    await act(async () => {
      result.current.markAllAsRead();
    });

    // 25 - 3, not 0: unread rows outside this page are still unread until loaded.
    await waitFor(() => expect(result.current.unreadCount).toBe(22));
    expect(requestCount('write')).toBe(3);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });
});