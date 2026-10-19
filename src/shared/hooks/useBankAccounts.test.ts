import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { IAccountWithBalance, IBalanceHistory } from '@/shared/types';
import { useBankAccounts, useUpdateBalance } from './useBankAccounts';

const api = vi.hoisted(() => ({
  getBalancesForOrgDate: vi.fn<(orgId: string, date: string) => Promise<IAccountWithBalance[]>>(),
  upsertBalance: vi.fn<
    (accountId: string, date: string, balance: number) => Promise<IBalanceHistory>
  >(),
}));

vi.mock('@/api/collections', () => api);

const toast = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock('@mantine/notifications', () => ({ notifications: toast }));

const ORG = 'org01hxyz';
const OTHER_ORG = 'org02hxyz';
const DATE = '2026-06-01';
const OTHER_DATE = '2026-06-02';
const KEY = ['bank_accounts', ORG, DATE];

function account(id: string, orgId = ORG) {
  return { id, organization_id: orgId, account_number: `40702800${id}` };
}

function withBalance(id: string, balance: number, orgId = ORG): IAccountWithBalance {
  return { account: account(id, orgId), balance };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

async function mountAccounts(orgId = ORG, date = DATE) {
  const client = createClient();
  const view = renderHook(() => useBankAccounts(orgId, date), { wrapper: wrapperFor(client) });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return { client, ...view };
}

beforeEach(() => {
  vi.resetAllMocks();

  api.getBalancesForOrgDate.mockImplementation((orgId: string) =>
    Promise.resolve([withBalance('ba1', 1000, orgId), withBalance('ba2', 2500, orgId)]),
  );
  api.upsertBalance.mockImplementation((accountId, date, balance) =>
    Promise.resolve({ id: `bh-${accountId}`, account_id: accountId, date, balance }),
  );
});

describe('useBankAccounts', () => {
  it('loads the accounts with balances in the shape the API returns', async () => {
    const { result } = await mountAccounts();

    expect(api.getBalancesForOrgDate).toHaveBeenCalledWith(ORG, DATE);
    expect(result.current.data).toEqual([
      { account: account('ba1'), balance: 1000 },
      { account: account('ba2'), balance: 2500 },
    ]);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('reports an empty response as an empty array, not undefined', async () => {
    api.getBalancesForOrgDate.mockResolvedValue([]);
    const { result } = await mountAccounts();

    expect(result.current.data).toEqual([]);
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.isSuccess).toBe(true);
  });

  it('surfaces a failure as an error and keeps the data slot empty', async () => {
    api.getBalancesForOrgDate.mockRejectedValue(new Error('HTTP 500'));
    const { result } = await mountAccounts();

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });

  it('reports isLoading while the read is in flight', async () => {
    const gate = deferred<IAccountWithBalance[]>();
    api.getBalancesForOrgDate.mockReturnValue(gate.promise);
    const client = createClient();

    const { result } = renderHook(() => useBankAccounts(ORG, DATE), {
      wrapper: wrapperFor(client),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      gate.resolve([withBalance('ba1', 1000)]);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
  });

  it('does not hit the API until both the organization and the date are known', async () => {
    const client = createClient();

    const noOrg = renderHook(() => useBankAccounts('', DATE), { wrapper: wrapperFor(client) });
    const noDate = renderHook(() => useBankAccounts(ORG, ''), { wrapper: wrapperFor(client) });
    const noBoth = renderHook(() => useBankAccounts('', ''), { wrapper: wrapperFor(client) });

    for (const view of [noOrg, noDate, noBoth]) {
      expect(view.result.current.fetchStatus).toBe('idle');
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.data).toBeUndefined();
    }
    expect(api.getBalancesForOrgDate).not.toHaveBeenCalled();
  });

  it('caches under the bank_accounts/organization/date key and re-reads when the date moves', async () => {
    const client = createClient();
    const { rerender } = renderHook(({ date }: { date: string }) => useBankAccounts(ORG, date), {
      wrapper: wrapperFor(client),
      initialProps: { date: DATE },
    });
    await waitFor(() => expect(api.getBalancesForOrgDate).toHaveBeenCalledTimes(1));

    expect(client.getQueryData<IAccountWithBalance[]>(KEY)).toHaveLength(2);

    rerender({ date: OTHER_DATE });
    await waitFor(() =>
      expect(api.getBalancesForOrgDate).toHaveBeenLastCalledWith(ORG, OTHER_DATE),
    );
    expect(client.getQueryData<IAccountWithBalance[]>(['bank_accounts', ORG, OTHER_DATE])).toHaveLength(2);
    expect(client.getQueryData<IAccountWithBalance[]>(KEY)).toHaveLength(2);
  });

  it('keeps organizations apart in the cache', async () => {
    const client = createClient();
    renderHook(
      () => {
        useBankAccounts(ORG, DATE);
        useBankAccounts(OTHER_ORG, DATE);
      },
      { wrapper: wrapperFor(client) },
    );
    await waitFor(() => expect(api.getBalancesForOrgDate).toHaveBeenCalledTimes(2));

    expect(client.getQueryData<IAccountWithBalance[]>(['bank_accounts', ORG, DATE])?.[0]?.account
      .organization_id).toBe(ORG);
    expect(
      client.getQueryData<IAccountWithBalance[]>(['bank_accounts', OTHER_ORG, DATE])?.[0]?.account
        .organization_id,
    ).toBe(OTHER_ORG);
  });

  it('serves a repeated read from the cache instead of the API', async () => {
    api.getBalancesForOrgDate.mockResolvedValue([withBalance('ba1', 1000)]);
    const client = createClient();

    const first = renderHook(() => useBankAccounts(ORG, DATE), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useBankAccounts(ORG, DATE), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(api.getBalancesForOrgDate).toHaveBeenCalledTimes(1));
    expect(second.result.current.data).toHaveLength(1);
  });
});

describe('useUpdateBalance', () => {
  function upsertCalls(accountId: string, date: string, balance: number): number {
    return api.upsertBalance.mock.calls.filter(
      ([id, d, b]) => id === accountId && d === date && b === balance,
    ).length;
  }

  it('forwards the account, the date and the balance to the API', async () => {
    const client = createClient();
    const { result } = renderHook(() => useUpdateBalance(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync({ accountId: 'ba1', date: DATE, balance: 4242 });
    });

    expect(upsertCalls('ba1', DATE, 4242)).toBe(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('re-reads every bank_accounts query on success, including other dates', async () => {
    const client = createClient();
    const gate = deferred<IAccountWithBalance[]>();
    api.getBalancesForOrgDate.mockReturnValue(gate.promise);

    let mutate: ReturnType<typeof useUpdateBalance>['mutateAsync'] | undefined;
    function Observer() {
      useBankAccounts(ORG, DATE);
      useBankAccounts(ORG, OTHER_DATE);
      useBankAccounts(OTHER_ORG, DATE);
      useQuery({ queryKey: ['invoices', ORG, DATE], queryFn: () => Promise.resolve([]) });
      mutate = useUpdateBalance().mutateAsync;
      return null;
    }
    render(createElement(Observer), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(api.getBalancesForOrgDate).toHaveBeenCalledTimes(3));
    const readsBefore = api.getBalancesForOrgDate.mock.calls.length;

    api.getBalancesForOrgDate.mockImplementation((orgId: string) =>
      Promise.resolve([withBalance('ba1', 1000, orgId)]),
    );
    await act(async () => {
      await mutate!({ accountId: 'ba1', date: DATE, balance: 1000 });
    });

    await waitFor(() => expect(api.getBalancesForOrgDate.mock.calls.length).toBe(readsBefore + 3));
    expect(client.getQueryState(['invoices', ORG, DATE])?.fetchStatus).not.toBe('fetching');
  }, 10000);

  it('re-reads the balances even when the write failed', async () => {
    api.upsertBalance.mockRejectedValue(new Error('HTTP 500'));
    const client = createClient();
    const { result } = renderHook(() => useBankAccounts(ORG, DATE), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const readsBefore = api.getBalancesForOrgDate.mock.calls.length;

    const mutation = renderHook(() => useUpdateBalance(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await mutation.result.current.mutateAsync({ accountId: 'ba1', date: DATE, balance: 1 });
    });

    await waitFor(() =>
      expect(api.getBalancesForOrgDate.mock.calls.length).toBeGreaterThan(readsBefore),
    );
  });

  it('shows a red notification when the write fails', async () => {
    api.upsertBalance.mockRejectedValue(new Error('boom'));
    const client = createClient();
    const { result } = renderHook(() => useUpdateBalance(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ accountId: 'ba1', date: DATE, balance: 1 }),
      ).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledTimes(1);
    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось сохранить остаток',
    });
  });
});
