import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import type { INotification } from '@/shared/types';
import { NOTIFICATIONS_PAGE_SIZE } from '@/api/collections';
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
  /** >= 400 fails every write with that HTTP status; `{ isAbort: true }` kills it mid-flight, as a cancelled duplicate PATCH would. */
  writeStatus: 200 as number | { readonly isAbort: true },
  /** Kills the page read the way a dropped connection does, instead of answering it. */
  pageAborts: false,
  /** Parks the reply of one kind until released: orders a write response against the realtime echo of that same write, or holds a read past unmount. */
  gate: null as null | { kind: CallKind; until: Promise<void> },
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
    const status = h.writeStatus;
    if (typeof status === 'object') throw aborted();
    if (status >= 400) {
      return jsonResponse(status, { code: status, message: 'write failed', data: {} });
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
  const gate = h.gate;
  if (gate?.kind === kind) await gate.until;
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

const BASE_MS = Date.UTC(2026, 8, 1, 10, 0, 0);

function stamp(minutesFromBase: number): string {
  return new Date(BASE_MS + minutesFromBase * 60_000).toISOString().replace('T', ' ');
}

/** `newestFirst(1, 20)` is `n1…n20` with `n1` the newest — the order `sort: '-created'` sends them in. `lifted` puts the whole block above everything else. */
function newestFirst(from: number, to: number, lifted = 0): INotification[] {
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const n = from + i;
    return notification(`n${n}`, { created: stamp(lifted - n) });
  });
}

function deferred(): { until: Promise<void>; release: () => void } {
  let release = () => {};
  const until = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { until, release };
}

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
  h.gate = null;
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

    // Installed after the mount, because `waitFor` takes over the clock it finds and
    // would never let `mountBell` finish. The retry backoff this case has to outlast is
    // scheduled by the action below, so from here on the fake clock is what runs it.
    vi.useFakeTimers();
    h.pageAborts = true;
    await act(async () => {
      result.current.retryNow();
    });

    // The entire retry budget elapses (1 s + 3 s). A superseded read is not a failure:
    // it must neither be retried nor reported, so the silence has to survive the whole
    // window in which a missing abort guard would have produced two extra attempts and
    // an error. Asserting right after the request — what this case used to do — cannot
    // tell the two apart, because that is before the broken guard has had a chance to act.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(requestCount('page')).toBe(2);
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

  // --- B: a re-check must not take back the rows the user paged in -----------------------

  it('a re-check keeps the rows «Показать ещё» paged in', async () => {
    const page1 = newestFirst(1, NOTIFICATIONS_PAGE_SIZE);
    const page2 = newestFirst(NOTIFICATIONS_PAGE_SIZE + 1, NOTIFICATIONS_PAGE_SIZE * 2);
    const { result } = await mountBell(server(page1, { totalItems: 40, unreadTotal: 40 }));
    expect(result.current.hasMore).toBe(true);

    // The second read asks for the rows older than the oldest one on screen, so the server
    // answers it with page 2 — then its newest page is back to page 1 for the re-check.
    h.fixture = server(page2, { totalItems: 40, unreadTotal: 40 });
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(40));
    h.fixture = server(page1, { totalItems: 40, unreadTotal: 40 });

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // The regression: a re-check that replaced the list would leave the 20 paged-in rows
    // unreachable again until the user clicked through them a second time.
    await waitFor(() => expect(result.current.notifications).toHaveLength(40));
    expect(ids(result.current)).toEqual([...page1, ...page2].map((n) => n.id));
    expect(requestCount('page')).toBe(3);
  });

  it('a re-check with nothing paged in replaces the list outright', async () => {
    const onScreen = newestFirst(1, NOTIFICATIONS_PAGE_SIZE);
    // Twenty newer notifications arrive, so the server's newest page is now entirely
    // different rows — none of them the user paged in, so none of them are owed back.
    const burst = newestFirst(NOTIFICATIONS_PAGE_SIZE + 1, NOTIFICATIONS_PAGE_SIZE * 2, 60);
    const { result } = await mountBell(server(onScreen, { totalItems: 40 }));
    expect(result.current.notifications).toHaveLength(20);

    h.fixture = server(burst, { totalItems: 40 });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(result.current.notifications).toHaveLength(20));
    expect(ids(result.current)).toEqual(burst.map((n) => n.id));
    // The replace path keeps `fresh` as it came: no leftover row, no row twice.
    expect(new Set(ids(result.current)).size).toBe(20);
    expect(result.current.hasMore).toBe(true);
  });

  it('a re-check sorts the merged list newest-first', async () => {
    const page1 = newestFirst(1, NOTIFICATIONS_PAGE_SIZE);
    const page2 = newestFirst(NOTIFICATIONS_PAGE_SIZE + 1, NOTIFICATIONS_PAGE_SIZE * 2);
    const { result } = await mountBell(server(page1, { totalItems: 41, unreadTotal: 41 }));

    h.fixture = server(page2, { totalItems: 41, unreadTotal: 41 });
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(40));

    // One brand-new notification lands on top of the page the server sends.
    h.fixture = server([notification('n0', { created: stamp(60) }), ...page1.slice(1)], {
      totalItems: 41,
      unreadTotal: 41,
    });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // 20 fresh + 21 kept (the oldest row of page 1 and all 20 paged in).
    await waitFor(() => expect(result.current.notifications).toHaveLength(41));
    expect(result.current.notifications[0]?.id).toBe('n0');
    expect(ids(result.current)).toContain('n40');
    const stamps = result.current.notifications.map((n) => n.created);
    expect([...stamps].sort().reverse()).toEqual(stamps);
  });

  it('a re-check stops offering «Показать ещё» once every row is held', async () => {
    const page1 = newestFirst(1, NOTIFICATIONS_PAGE_SIZE);
    const page2 = newestFirst(NOTIFICATIONS_PAGE_SIZE + 1, NOTIFICATIONS_PAGE_SIZE * 2);
    const { result } = await mountBell(server(page1, { totalItems: 40, unreadTotal: 40 }));

    h.fixture = server(page2, { totalItems: 40, unreadTotal: 40 });
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.notifications).toHaveLength(40));
    expect(result.current.hasMore).toBe(false);

    h.fixture = server(page1, { totalItems: 40, unreadTotal: 40 });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // 40 held of 40 total. The re-check must count what is now on screen, not the 20
    // rows the fresh page happened to carry — otherwise the button reappears over rows
    // the user already has.
    await waitFor(() => expect(result.current.notifications).toHaveLength(40));
    expect(result.current.hasMore).toBe(false);
  });

  // --- E: a failed write is reported, and nothing it owned is destroyed ---------------

  it('a failed mark-as-read write reports the failure and leaves the row unread', async () => {
    const pair = [notification('n1'), notification('n2')];
    const { result } = await mountBell(server(pair, { totalItems: 2, unreadTotal: 25 }));
    h.writeStatus = 500;

    await act(async () => {
      result.current.markAsRead('n1');
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Не удалось отметить как прочитанное (HTTP 500)');
    expect(ids(result.current)).toEqual(['n1', 'n2']);
    expect(result.current.notifications.map((n) => n.read)).toEqual([false, false]);
    expect(result.current.unreadCount).toBe(25);
  });

  it('a failed mark-all-read write reports the failure and leaves every row unread', async () => {
    const page = [
      notification('n1'),
      notification('n2'),
      notification('n3'),
      notification('n4', { read: true }),
    ];
    const { result } = await mountBell(server(page, { totalItems: 4, unreadTotal: 25 }));
    h.writeStatus = 500;

    await act(async () => {
      result.current.markAllAsRead();
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Не удалось отметить как прочитанное (HTTP 500)');
    expect(requestCount('write')).toBe(3);
    expect(result.current.notifications.map((n) => n.read)).toEqual([false, false, false, true]);
    expect(result.current.unreadCount).toBe(25);
  });

  it('a failed «Показать ещё» keeps the rows already on screen', async () => {
    const page1 = newestFirst(1, NOTIFICATIONS_PAGE_SIZE);
    const page2 = newestFirst(NOTIFICATIONS_PAGE_SIZE + 1, NOTIFICATIONS_PAGE_SIZE * 2);
    const { result } = await mountBell(server(page1, { totalItems: 40 }));
    expect(result.current.hasMore).toBe(true);

    h.fixture = server(page2, { totalItems: 40 });
    h.listStatus = 500;
    await act(async () => {
      result.current.loadMore();
    });

    // The next page is missing, so it is the read that is named in the message — not the
    // «отметить как прочитанное» one a failed write uses.
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Ошибка загрузки уведомлений (HTTP 500)');
    expect(ids(result.current)).toEqual(page1.map((n) => n.id));
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('an aborted write is not reported as an error', async () => {
    const pair = [notification('n1'), notification('n2')];
    const { result } = await mountBell(server(pair, { totalItems: 2, unreadTotal: 25 }));

    // The anchor: a write that does land flips its row, so the silence asserted below is
    // silence and not a chain that never resolved.
    await act(async () => {
      result.current.markAsRead('n1');
    });
    await waitFor(() => expect(result.current.notifications[0]?.read).toBe(true));
    expect(result.current.error).toBeNull();

    // The SDK cancels duplicate PATCHes to one record URL, so the loser of a duplicated
    // mark is aborted rather than failed — a red banner there would be a lie.
    h.writeStatus = { isAbort: true };
    await act(async () => {
      result.current.markAsRead('n2');
    });

    expect(requestCount('write')).toBe(2);
    expect(result.current.error).toBeNull();
    expect(result.current.notifications.map((n) => n.read)).toEqual([true, false]);
    // Nothing was marked, so nothing may be taken off the badge either.
    expect(result.current.unreadCount).toBe(24);
  });

  // --- G: one read-transition, one charge, on whichever bell observes it first ----------

  it('a realtime read-transition decrements the badge that did not get the click', async () => {
    const pair = [notification('n1'), notification('n2')];
    const { result } = await mountBell(server(pair, { totalItems: 2, unreadTotal: 25 }));
    await waitFor(() => expect(h.listeners).toHaveLength(1));

    await act(async () => {
      h.listeners[0]?.({ action: 'update', record: notification('n1', { read: true }) });
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(24));
    expect(result.current.notifications.map((n) => n.read)).toEqual([true, false]);
  });

  it('the same read-transition delivered twice charges the badge once', async () => {
    const pair = [notification('n1'), notification('n2')];
    const { result } = await mountBell(server(pair, { totalItems: 2, unreadTotal: 25 }));
    await waitFor(() => expect(h.listeners).toHaveLength(1));
    const echo = { action: 'update', record: notification('n1', { read: true }) } as const;

    await act(async () => {
      h.listeners[0]?.(echo);
    });
    await waitFor(() => expect(result.current.unreadCount).toBe(24));

    // A duplicate delivery of the same event — the second observer sees the row already
    // read, so there is no transition left to charge for.
    await act(async () => {
      h.listeners[0]?.(echo);
    });

    expect(result.current.unreadCount).toBe(24);
  });

  it('a realtime update that leaves a record unread does not move the badge', async () => {
    const pair = [notification('n1'), notification('n2')];
    const { result } = await mountBell(server(pair, { totalItems: 2, unreadTotal: 25 }));
    await waitFor(() => expect(h.listeners).toHaveLength(1));

    // A `message` edit arrives still unread: not a transition, so nothing is charged.
    await act(async () => {
      h.listeners[0]?.({
        action: 'update',
        record: notification('n1', { message: 'Счёт изменён' }),
      });
    });

    expect(result.current.unreadCount).toBe(25);
    expect(result.current.notifications.map((n) => n.read)).toEqual([false, false]);
    expect(result.current.notifications[0]?.message).toBe('Счёт изменён');
  });

  it('the write response does not charge a read the realtime echo already charged', async () => {
    const pair = [notification('n1'), notification('n2')];
    const { result } = await mountBell(server(pair, { totalItems: 2, unreadTotal: 25 }));
    await waitFor(() => expect(h.listeners).toHaveLength(1));

    const write = deferred();
    h.gate = { kind: 'write', until: write.until };
    await act(async () => {
      result.current.markAsRead('n1');
    });
    expect(requestCount('write')).toBe(1);

    // The echo of this very write arrives first: the server has already applied it.
    await act(async () => {
      h.listeners[0]?.({ action: 'update', record: notification('n1', { read: true }) });
    });
    await waitFor(() => expect(result.current.unreadCount).toBe(24));

    // The write response, once it lands, must find nothing left to charge.
    await act(async () => {
      write.release();
    });
    expect(requestCount('write')).toBe(1);

    expect(result.current.unreadCount).toBe(24);
    expect(result.current.notifications.map((n) => n.read)).toEqual([true, false]);
  });

  it('charges a read once when both observers arrive before any commit', async () => {
    const pair = [notification('n1'), notification('n2')];
    const { result } = await mountBell(server(pair, { totalItems: 2, unreadTotal: 25 }));
    await waitFor(() => expect(h.listeners).toHaveLength(1));

    const write = deferred();
    h.gate = { kind: 'write', until: write.until };
    await act(async () => {
      result.current.markAsRead('n1');
    });
    expect(requestCount('write')).toBe(1);

    // Both observers of this one transition, deliberately NOT wrapped in `act`. `act` flushes
    // React's commit *and* its passive effects before it returns, and it queues that flush at
    // entry — so every microtask this test schedules runs after the ref has already been
    // republished, and the case passes against a double charge. Outside `act`, React commits
    // on the scheduler's macrotask while the write response continues on microtasks, which is
    // the browser ordering the defect actually depends on: commit in a microtask, passive
    // effects in a macrotask. React's "not wrapped in act" warning below is the direct
    // consequence and is expected — do not silence it by adding `act` back.
    h.listeners[0]?.({ action: 'update', record: notification('n1', { read: true }) });
    write.release();

    // One transition, so one charge: 25 - 1. A ref published by an effect is still holding the
    // pre-commit rows when the response arrives, finds n1 unread a second time, charges again,
    // and lands on 23.
    await waitFor(() => expect(result.current.unreadCount).toBe(24));
    expect(result.current.notifications.map((n) => n.read)).toEqual([true, false]);
  });

  it('the realtime echo does not charge a read the write response already charged', async () => {
    const pair = [notification('n1'), notification('n2')];
    const { result } = await mountBell(server(pair, { totalItems: 2, unreadTotal: 25 }));
    await waitFor(() => expect(h.listeners).toHaveLength(1));

    const write = deferred();
    h.gate = { kind: 'write', until: write.until };
    await act(async () => {
      result.current.markAsRead('n1');
    });
    await act(async () => {
      write.release();
    });
    await waitFor(() => expect(result.current.unreadCount).toBe(24));

    // The other order of the same two observers, for the bell that was not the one clicked.
    await act(async () => {
      h.listeners[0]?.({ action: 'update', record: notification('n1', { read: true }) });
    });

    expect(result.current.unreadCount).toBe(24);
    expect(result.current.notifications.map((n) => n.read)).toEqual([true, false]);
  });

  it('the echoes of a mark-all-read do not re-charge what its response charged', async () => {
    const page = [
      notification('n1'),
      notification('n2'),
      notification('n3'),
      notification('n4', { read: true }),
    ];
    const { result } = await mountBell(server(page, { totalItems: 4, unreadTotal: 25 }));
    await waitFor(() => expect(h.listeners).toHaveLength(1));

    const writes = deferred();
    h.gate = { kind: 'write', until: writes.until };
    await act(async () => {
      result.current.markAllAsRead();
    });
    expect(requestCount('write')).toBe(3);

    // Each of those three writes echoes while its row is still unread on screen, so each
    // echo is a real transition and charges one — 25 - 3.
    await act(async () => {
      h.listeners[0]?.({ action: 'update', record: notification('n1', { read: true }) });
      h.listeners[0]?.({ action: 'update', record: notification('n2', { read: true }) });
    });
    await act(async () => {
      h.listeners[0]?.({ action: 'update', record: notification('n3', { read: true }) });
    });
    await waitFor(() => expect(result.current.unreadCount).toBe(22));

    // The write responses land last and must find all three already charged, so the total
    // stays at 22 instead of falling to 19.
    await act(async () => {
      writes.release();
    });

    expect(result.current.unreadCount).toBe(22);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it('both bells land on the same total when only one of them got the click', async () => {
    const pair = [notification('n1'), notification('n2')];
    h.fixture = server(pair, { totalItems: 2, unreadTotal: 25 });
    const { sink } = renderBells(['a', 'b']);

    await waitFor(() => {
      expect(sink.a?.unreadCount).toBe(25);
      expect(sink.b?.unreadCount).toBe(25);
    });
    await waitFor(() => expect(h.listeners).toHaveLength(2));

    // The click happened in bell `a` alone; its write response charges it…
    await act(async () => {
      (sink.a as HookResult).markAsRead('n1');
    });
    await waitFor(() => expect(sink.a?.unreadCount).toBe(24));

    // …and bell `b`, which only ever sees the realtime echo, lands on the same number
    // instead of waiting for its next re-check to find out.
    await act(async () => {
      for (const listener of h.listeners) {
        listener({ action: 'update', record: notification('n1', { read: true }) });
      }
    });

    expect(sink.a?.unreadCount).toBe(24);
    expect(sink.b?.unreadCount).toBe(24);
  });

  // --- re-check triggers and their guards ----------------------------------------------

  it('refetches when the window regains focus', async () => {
    const { result } = await mountBell(server([notification('n1')]));

    h.fixture = server([notification('n1'), notification('n2')]);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(ids(result.current)).toEqual(['n1', 'n2']));
    expect(requestCount('page')).toBe(2);
  });

  it('ignores visibilitychange while the tab is hidden and refetches when it is visible', async () => {
    const { result } = await mountBell(server([notification('n1')]));

    setVisibility('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // A tab that is going away must not spend a request.
    expect(requestCount('page')).toBe(1);
    expect(ids(result.current)).toEqual(['n1']);

    h.fixture = server([notification('n1'), notification('n2')]);
    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(ids(result.current)).toEqual(['n1', 'n2']));
    expect(requestCount('page')).toBe(2);
  });

  it('drops a re-check that arrives while the previous one is still in flight', async () => {
    const { result } = await mountBell(server([notification('n1')]));

    h.fixture = server([notification('n1'), notification('n2')]);
    // Both events land in one tick, before the first read has resolved.
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(ids(result.current)).toEqual(['n1', 'n2']));
    expect(requestCount('page')).toBe(2);
    expect(requestCount('count')).toBe(2);
  });

  it('unmounting with a read in flight releases the feed and drops the late response', async () => {
    const page = deferred();
    h.gate = { kind: 'page', until: page.until };

    const view = renderHook(() => useNotifications());
    await waitFor(() => expect(requestCount('page')).toBe(1));
    await waitFor(() => expect(h.unsubscribes).toHaveLength(1));

    view.unmount();
    await act(async () => {
      page.release();
    });

    expect(h.unsubscribes[0]).toHaveBeenCalledTimes(1);

    // The triggers are gone with the instance, so a late `focus` cannot start a read on a
    // hook that no longer has anywhere to put the answer.
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(requestCount('page')).toBe(1);
  });
});