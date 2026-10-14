import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IInvoice } from '@/shared/types';
import { useDeleteInvoice } from './useDeleteInvoice';

const { deleteInvoice } = vi.hoisted(() => ({ deleteInvoice: vi.fn() }));

vi.mock('@/api/collections', () => ({ deleteInvoice }));

const ORG_ID = 'org1';
const DATE = '2026-06-01';
const KEY = ['invoices', ORG_ID, DATE];

function invoice(id: string): IInvoice {
  return {
    id,
    organization_id: ORG_ID,
    accounting_object_id: 'ao1',
    date: DATE,
    seq: 1,
    counterparty: 'ООО "Тест"',
    purpose: 'Оплата работ',
    contract_no: 'Д-1',
    invoice_no: id,
    amount: 50000,
    paid: false,
    paid_amount: null,
    payment_amounts: [],
    paid_date: '',
    comment: '',
    created_by: 'admin1',
    updated_by: 'admin1',
    copy_comments: {},
    source_paid_amount: 0,
    source_paid_date: '',
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData<IInvoice[]>(KEY, [invoice('inv1'), invoice('inv2')]);

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  }

  const view = renderHook(() => useDeleteInvoice(ORG_ID, DATE), { wrapper: Wrapper });

  return { client, ...view };
}

const cachedIds = (client: QueryClient) =>
  (client.getQueryData<IInvoice[]>(KEY) ?? []).map((inv) => inv.id);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  deleteInvoice.mockReset();
});

describe('useDeleteInvoice', () => {
  it('forwards the id and the reason to the API', async () => {
    deleteInvoice.mockResolvedValue(undefined);
    const { result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ id: 'inv1', reason: 'счёт создан ошибочно' });
    });

    expect(deleteInvoice).toHaveBeenCalledWith('inv1', 'счёт создан ошибочно');
  });

  it('removes the deleted invoice from the cache optimistically', async () => {
    deleteInvoice.mockResolvedValue(undefined);
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ id: 'inv1', reason: 'дубль' });
    });

    // Регрессия: пока переменные мутации были строкой, фильтр сравнивал `inv.id` с
    // объектом переменных, не совпадал ни с одной строкой и ничего не убирал.
    expect(cachedIds(client)).toEqual(['inv2']);
  });

  it('leaves the other rows untouched when deleting by a synthetic copy id', async () => {
    deleteInvoice.mockResolvedValue(undefined);
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ id: 'inv2', reason: 'частичная оплата' });
    });

    expect(cachedIds(client)).toEqual(['inv1']);
  });

  it('restores the cache when the mutation fails', async () => {
    const gate = deferred<void>();
    deleteInvoice.mockReturnValue(gate.promise);
    const { client, result } = setup();

    await act(async () => {
      result.current.mutate({ id: 'inv1', reason: 'дубль' });
    });
    // Строка исчезает до ответа сервера — только тогда проверка отката что-то значит.
    expect(cachedIds(client)).toEqual(['inv2']);

    await act(async () => {
      gate.reject(new Error('server down'));
    });

    await vi.waitFor(() => expect(cachedIds(client)).toEqual(['inv1', 'inv2']));
  });
});
