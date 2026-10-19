import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOrgCounterparties } from './useOrgCounterparties';

/**
 * Словарь контрагентов организации: подсказки для полей «Отправитель»/
 * «Получатель».
 *
 * Шов — модульный мок `@/api/mail` (приём из `useMail.test.ts`). Здесь важны
 * вещи, которых нет на HTTP-уровне: ИМЯ ключа запроса, второй позиционный
 * аргумент `enabled` и то, что до ответа хук отдаёт не `undefined`, а
 * постоянную ссылку на пустой массив. Словарь формируется тремя запросами на
 * сервере и сводится в `getOrgCounterpartyVocabulary`; проверять его морфологию
 * здесь незачем — это уже сделано в `src/api/mail.vocabulary.test.ts`.
 *
 * Про постоянную ссылку стоит сказать отдельно: `NO_COUNTERPARTIES` в модуле
 * один на всех, и `Autocomplete` из-за неё не пересобирает выпадающий список
 * впустую на каждом рендере. Поэтому проверяется не только значение, но и
 * тождественность ссылки между двумя рендерами.
 */

const api = vi.hoisted(() => ({
  getOrgCounterpartyVocabulary: vi.fn<(orgId: string) => Promise<string[]>>(),
}));

vi.mock('@/api/mail', () => api);

const ORG = 'org01hxyz';
const OTHER_ORG = 'org02hxyz';
const VOCABULARY = ['ООО Ромашка', 'ООО Одуванчик'];

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

/** Ответ отложен вручную: пока он не подан, хук остаётся в загрузке. */
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
  vi.resetAllMocks();
  api.getOrgCounterpartyVocabulary.mockResolvedValue(VOCABULARY);
});

// --- Ключ запроса и форма ответа -------------------------------------------

describe('useOrgCounterparties: ключ запроса и форма ответа', () => {
  it('словарь читается по ключу [mailCounterpartyVocabulary, org]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useOrgCounterparties(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getOrgCounterpartyVocabulary).toHaveBeenCalledTimes(1);
    expect(api.getOrgCounterpartyVocabulary).toHaveBeenCalledWith(ORG);
    expect(client.getQueryData(['mailCounterpartyVocabulary', ORG])).toBe(result.current.data);
    // Подсказки — тот же массив, что пришёл из кэша, а не его копия.
    expect(result.current.counterpartyOptions).toBe(result.current.data);
    expect(result.current.counterpartyOptions).toEqual(['ООО Ромашка', 'ООО Одуванчик']);
  });

  it('пустой словарь остаётся пустым массивом, а не undefined', async () => {
    api.getOrgCounterpartyVocabulary.mockResolvedValue([]);
    const client = createClient();
    const { result } = renderHook(() => useOrgCounterparties(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.counterpartyOptions).toEqual([]);
    expect(result.current.data).toEqual([]);
  });

  it('две организации не делят запись словаря', async () => {
    api.getOrgCounterpartyVocabulary.mockImplementation((orgId: string) =>
      Promise.resolve(orgId === ORG ? VOCABULARY : ['ИП Ёжик']),
    );
    const client = createClient();
    const { result } = renderHook(
      () => ({ own: useOrgCounterparties(ORG), other: useOrgCounterparties(OTHER_ORG) }),
      { wrapper: wrapperFor(client) },
    );
    await waitFor(() => {
      expect(result.current.own.isSuccess).toBe(true);
      expect(result.current.other.isSuccess).toBe(true);
    });

    expect(result.current.own.counterpartyOptions).toEqual(['ООО Ромашка', 'ООО Одуванчик']);
    expect(result.current.other.counterpartyOptions).toEqual(['ИП Ёжик']);
    expect(client.getQueryData(['mailCounterpartyVocabulary', ORG])).not.toBe(
      client.getQueryData(['mailCounterpartyVocabulary', OTHER_ORG]),
    );
  });

  it('смена организации перечитывает словарь', async () => {
    api.getOrgCounterpartyVocabulary.mockImplementation((orgId: string) =>
      Promise.resolve(orgId === ORG ? VOCABULARY : ['ИП Ёжик']),
    );
    const client = createClient();
    const { result, rerender } = renderHook(({ orgId }: { orgId: string }) => useOrgCounterparties(orgId), {
      wrapper: wrapperFor(client),
      initialProps: { orgId: ORG },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ orgId: OTHER_ORG });

    await waitFor(() => expect(result.current.counterpartyOptions).toEqual(['ИП Ёжик']));
    expect(api.getOrgCounterpartyVocabulary).toHaveBeenCalledTimes(2);
    expect(api.getOrgCounterpartyVocabulary).toHaveBeenLastCalledWith(OTHER_ORG);
  });
});

// --- Загрузка и отказ --------------------------------------------------------

describe('useOrgCounterparties: загрузка и отказ', () => {
  it('до ответа подсказки пусты, а запрос в самом разгаре', async () => {
    const gate = deferred<string[]>();
    api.getOrgCounterpartyVocabulary.mockReturnValue(gate.promise);
    const client = createClient();
    const { result } = renderHook(() => useOrgCounterparties(ORG), { wrapper: wrapperFor(client) });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.fetchStatus).toBe('fetching');
    expect(result.current.data).toBeUndefined();
    expect(result.current.counterpartyOptions).toEqual([]);

    await act(async () => {
      gate.resolve(VOCABULARY);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.counterpartyOptions).toEqual(VOCABULARY);
  });

  it('отказ запроса не оставляет подсказки undefined', async () => {
    api.getOrgCounterpartyVocabulary.mockRejectedValue(new Error('сервер недоступен'));
    const client = createClient();
    const { result } = renderHook(() => useOrgCounterparties(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.counterpartyOptions).toEqual([]);
    // Повторных попыток нет: тестовый клиент отключает `retry`.
    expect(api.getOrgCounterpartyVocabulary).toHaveBeenCalledTimes(1);
  });
});

// --- Отключение запроса ------------------------------------------------------

describe('useOrgCounterparties: когда запрос не уходит', () => {
  it('выключенный флаг не отправляет запрос', () => {
    const client = createClient();
    const { result } = renderHook(() => useOrgCounterparties(ORG, false), {
      wrapper: wrapperFor(client),
    });

    expect(api.getOrgCounterpartyVocabulary).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
// Выключенная запись непрочитана, поэтому `isPending` у неё `true` — «данных
// ещё нет»; мигает индикатор только когда есть и `isPending`, и чтение.
expect(result.current.isLoading).toBe(false);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.counterpartyOptions).toEqual([]);
  });

  it('пустая организация не отправляет запрос даже при включённом флаге', () => {
    const client = createClient();
    const { result } = renderHook(() => useOrgCounterparties('', true), { wrapper: wrapperFor(client) });

    expect(api.getOrgCounterpartyVocabulary).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.counterpartyOptions).toEqual([]);
  });

  it('включение флага после монтирования досылает запрос', async () => {
    const client = createClient();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useOrgCounterparties(ORG, enabled),
      { wrapper: wrapperFor(client), initialProps: { enabled: false } },
    );
    expect(api.getOrgCounterpartyVocabulary).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.getOrgCounterpartyVocabulary).toHaveBeenCalledTimes(1);
    expect(api.getOrgCounterpartyVocabulary).toHaveBeenCalledWith(ORG);
  });

  it('пустая организация при выключенном флаге — запрос не уходит и при смене организации', () => {
    const client = createClient();
    const { rerender } = renderHook(({ orgId }: { orgId: string }) => useOrgCounterparties(orgId, false), {
      wrapper: wrapperFor(client),
      initialProps: { orgId: ORG },
    });

    rerender({ orgId: OTHER_ORG });

    expect(api.getOrgCounterpartyVocabulary).not.toHaveBeenCalled();
  });
});

// --- Постоянная ссылка и время жизни записи ---------------------------------

describe('useOrgCounterparties: постоянная пустая ссылка и staleTime', () => {
  it('до ответа ссылка на пустой список одна и та же между рендерами', () => {
    const gate = deferred<string[]>();
    api.getOrgCounterpartyVocabulary.mockReturnValue(gate.promise);
    const client = createClient();
    const { result, rerender } = renderHook(() => useOrgCounterparties(ORG), {
      wrapper: wrapperFor(client),
    });
    const first = result.current.counterpartyOptions;

    rerender();
    rerender();

    // Ровно это и делает `NO_COUNTERPARTIES`: `Autocomplete` не видит нового
    // массива на каждом рендере и не пересобирает выпадающий список впустую.
    expect(result.current.counterpartyOptions).toBe(first);
    expect(result.current.counterpartyOptions).toEqual([]);

    return act(async () => {
      gate.resolve(VOCABULARY);
    });
  });

  it('словарь живёт десять минут: свежие данные не перечитываются', async () => {
    const client = createClient();
    const { result } = renderHook(
      () => ({ form: useOrgCounterparties(ORG), editor: useOrgCounterparties(ORG) }),
      { wrapper: wrapperFor(client) },
    );
    await waitFor(() => expect(result.current.form.isSuccess).toBe(true));

    // Два наблюдателя одного ключа делят одну запись, и пока она свежая, второй
    // запрос не уходит — это и есть `staleTime`.
    expect(api.getOrgCounterpartyVocabulary).toHaveBeenCalledTimes(1);
    expect(result.current.editor.counterpartyOptions).toBe(result.current.form.counterpartyOptions);

    const cached = client.getQueryCache().find({ queryKey: ['mailCounterpartyVocabulary', ORG] });
    expect(cached?.options.staleTime).toBe(10 * 60_000);
  });
});