import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MAIL_FILES_COLLECTION, MAIL_RELATIONS_COLLECTION } from '@/api/mail';
import type { IMailFile, IMailRelation } from '@/shared/types';
import {
  filterByAttachments,
  filterByRelations,
  useOrgMailFiles,
  useOrgMailRelationIds,
} from './useOrgMailFiles';

/**
 * Организационные выборки почты: вложения и связи одним запросом на
 * организацию плюс чистые отборы по уже загруженной странице.
 *
 * Шов — модульный мок `@/api/client`. Оба хука ходят в PocketBase напрямую, минуя
 * `@/api/mail`, и HTTP-уровень здесь ничего не проверял бы: контракт состоит из
 * ИМЕНИ коллекции, ТОЧНОЙ строки фильтра и списка запрошенных полей — а ещё
 * разбора ответа в две карты. Имена коллекций в тесте берутся из самого
 * `@/api/mail`, поэтому переименование константы здесь не спрячется.
 *
 * Отдельно проверяется инвариант, на котором стоит фильтр «Без вложений»:
 * письмо с вложением обязано остаться в `countsByMailId` даже тогда, когда имя
 * файла пустое, — иначе письмо выпало бы из отбора. Имя при этом в
 * `namesByMailId` не попадает, потому что колонке «Файлы» нечего печатать.
 */

const pbMock = vi.hoisted(() => ({
  getFullList: vi.fn<
    (collection: string, options?: Record<string, unknown>) => Promise<unknown[]>
  >(),
}));

vi.mock('@/api/client', () => ({
  pb: {
    collection: (name: string) => ({
      getFullList: (options?: Record<string, unknown>) => pbMock.getFullList(name, options),
    }),
  },
}));

const ORG = 'org01hxyz';
const OTHER_ORG = 'org02hxyz';
const MAIL_A = 'mail01hxyz';
const MAIL_B = 'mail02hxyz';
const MAIL_C = 'mail03hxyz';

const FILE_FIELDS = 'id,mail_id,mail_type,organization_id,file,name,created';
const RELATION_FIELDS =
  'id,parent_incoming_mail_id,child_incoming_mail_id,parent_outgoing_mail_id,child_outgoing_mail_id';

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mailFile(id: string, mailId: string, over: Partial<IMailFile> = {}): IMailFile {
  return {
    id,
    mail_id: mailId,
    mail_type: 'incoming',
    organization_id: ORG,
    file: [`${id}.pdf`],
    name: `${id}.pdf`,
    ...over,
  };
}

function relation(id: string, over: Partial<IMailRelation> = {}): IMailRelation {
  return { id, organization_id: ORG, ...over };
}

beforeEach(() => {
  vi.resetAllMocks();
  pbMock.getFullList.mockImplementation((collection: string) =>
    Promise.resolve(collection === MAIL_FILES_COLLECTION ? [] : []),
  );
});

// --- useOrgMailFiles ---------------------------------------------------------

describe('useOrgMailFiles: запрос вложений организации', () => {
  it('читается по ключу [mail_files_org, org], нужной коллекцией и фильтром', async () => {
    const files = [mailFile('mf01hxyz', MAIL_A)];
    pbMock.getFullList.mockResolvedValue(files);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailFiles(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pbMock.getFullList).toHaveBeenCalledTimes(1);
    expect(pbMock.getFullList).toHaveBeenCalledWith(MAIL_FILES_COLLECTION, {
      filter: `organization_id = "${ORG}"`,
      fields: FILE_FIELDS,
    });
    expect(result.current.data).toEqual(files);
    expect(client.getQueryData(['mail_files_org', ORG])).toBe(result.current.data);
  });

  it('пустой ответ даёт две пустые карты, а не undefined', async () => {
    pbMock.getFullList.mockResolvedValue([]);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailFiles(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
    expect(result.current.countsByMailId.size).toBe(0);
    expect(result.current.namesByMailId.size).toBe(0);
  });

  it('отказ запроса оставляет карты пустыми, а ошибку на месте', async () => {
    pbMock.getFullList.mockRejectedValue(new Error('сервер недоступен'));
    const client = createClient();
    const { result } = renderHook(() => useOrgMailFiles(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
    expect(result.current.countsByMailId.size).toBe(0);
    expect(result.current.namesByMailId.size).toBe(0);
  });

  it('пока вложения грузятся, карты уже есть и показывают ноль', async () => {
    const gate = deferred<unknown[]>();
    pbMock.getFullList.mockReturnValue(gate.promise);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailFiles(ORG), { wrapper: wrapperFor(client) });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.countsByMailId.size).toBe(0);
    expect(result.current.namesByMailId.size).toBe(0);

    await act(async () => {
      gate.resolve([mailFile('mf01hxyz', MAIL_A)]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.countsByMailId.get(MAIL_A)).toBe(1);
  });

  it('пустая организация не отправляет запрос', () => {
    const client = createClient();
    const { result } = renderHook(() => useOrgMailFiles(''), { wrapper: wrapperFor(client) });

    expect(pbMock.getFullList).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.countsByMailId.size).toBe(0);
  });

  it('смена организации перечитывает вложения и меняет счётчики', async () => {
    pbMock.getFullList.mockImplementation((collection: string) => {
      if (collection !== MAIL_FILES_COLLECTION) return Promise.resolve([]);
      const org = pbMock.getFullList.mock.calls.at(-1)?.[1];
      const orgId = String((org as { filter: string }).filter).includes(OTHER_ORG)
        ? OTHER_ORG
        : ORG;
      return Promise.resolve([mailFile(`mf-${orgId}`, MAIL_A, { organization_id: orgId })]);
    });
    const client = createClient();
    const { result, rerender } = renderHook(({ orgId }: { orgId: string }) => useOrgMailFiles(orgId), {
      wrapper: wrapperFor(client),
      initialProps: { orgId: ORG },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.countsByMailId.has(`mf-${ORG}`)).toBe(false);

    rerender({ orgId: OTHER_ORG });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pbMock.getFullList).toHaveBeenCalledTimes(2);
    expect(pbMock.getFullList).toHaveBeenLastCalledWith(MAIL_FILES_COLLECTION, {
      filter: `organization_id = "${OTHER_ORG}"`,
      fields: FILE_FIELDS,
    });
    expect(client.getQueryData(['mail_files_org', ORG])).not.toBe(
      client.getQueryData(['mail_files_org', OTHER_ORG]),
    );
  });
});

describe('useOrgMailFiles: разбор вложений в карты', () => {
  it('счётчик считает записи одного письма, а не файлы в них', async () => {
    pbMock.getFullList.mockResolvedValue([
      mailFile('mf01hxyz', MAIL_A, { file: ['Договор.pdf', 'Счёт.pdf'] }),
      mailFile('mf02hxyz', MAIL_A),
      mailFile('mf03hxyz', MAIL_B),
    ]);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailFiles(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.countsByMailId.get(MAIL_A)).toBe(2);
    expect(result.current.countsByMailId.get(MAIL_B)).toBe(1);
    expect(result.current.countsByMailId.has(MAIL_C)).toBe(false);
  });

  it('подписи собираются в порядке записей и обрезаются по краям', async () => {
    pbMock.getFullList.mockResolvedValue([
      mailFile('mf01hxyz', MAIL_A, { name: '  Договор.pdf  ' }),
      mailFile('mf02hxyz', MAIL_A, { name: 'Счёт.pdf' }),
      mailFile('mf03hxyz', MAIL_B, { name: 'Акт.pdf' }),
    ]);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailFiles(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.namesByMailId.get(MAIL_A)).toEqual(['Договор.pdf', 'Счёт.pdf']);
    expect(result.current.namesByMailId.get(MAIL_B)).toEqual(['Акт.pdf']);
  });

  it('запись без имени остаётся в счётчике, но в подписи не попадает', async () => {
    pbMock.getFullList.mockResolvedValue([
      mailFile('mf01hxyz', MAIL_A, { name: '' }),
      mailFile('mf02hxyz', MAIL_B, { name: '   ' }),
    ]);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailFiles(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Именно этот инвариант держит фильтр «Без вложений»: вычеркнуть письмо с
    // вложением из счётчика — значит показать его как письмо без вложений.
    expect(result.current.countsByMailId.get(MAIL_A)).toBe(1);
    expect(result.current.countsByMailId.get(MAIL_B)).toBe(1);
    expect(result.current.namesByMailId.size).toBe(0);
  });
});

// --- useOrgMailRelationIds ---------------------------------------------------

describe('useOrgMailRelationIds: запрос связей организации', () => {
  it('читается по ключу [mail_relations_org, org] и всем четырём полям связи', async () => {
    const relations = [relation('rel01hxyz', { parent_incoming_mail_id: MAIL_A })];
    pbMock.getFullList.mockResolvedValue(relations);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailRelationIds(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pbMock.getFullList).toHaveBeenCalledTimes(1);
    expect(pbMock.getFullList).toHaveBeenCalledWith(MAIL_RELATIONS_COLLECTION, {
      filter: `organization_id = "${ORG}"`,
      fields: RELATION_FIELDS,
    });
    expect(result.current.data).toEqual(relations);
    expect(client.getQueryData(['mail_relations_org', ORG])).toBe(result.current.data);
  });

  it('пустой ответ даёт два пустых множества', async () => {
    pbMock.getFullList.mockResolvedValue([]);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailRelationIds(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.linkedByType.incoming.size).toBe(0);
    expect(result.current.linkedByType.outgoing.size).toBe(0);
  });

  it('отказ запроса оставляет оба множества пустыми', async () => {
    pbMock.getFullList.mockRejectedValue(new Error('сервер недоступен'));
    const client = createClient();
    const { result } = renderHook(() => useOrgMailRelationIds(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.linkedByType.incoming.size).toBe(0);
    expect(result.current.linkedByType.outgoing.size).toBe(0);
  });

  it('пустая организация не отправляет запрос', () => {
    const client = createClient();
    const { result } = renderHook(() => useOrgMailRelationIds(''), { wrapper: wrapperFor(client) });

    expect(pbMock.getFullList).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.linkedByType.incoming.size).toBe(0);
  });

  it('связь внутри одного регистра кладёт оба конца только в свой регистр', async () => {
    pbMock.getFullList.mockResolvedValue([
      relation('rel01hxyz', {
        parent_incoming_mail_id: MAIL_A,
        child_incoming_mail_id: MAIL_B,
      }),
    ]);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailRelationIds(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect([...result.current.linkedByType.incoming]).toEqual([MAIL_A, MAIL_B]);
    expect(result.current.linkedByType.outgoing.size).toBe(0);
  });

  it('межрегистровая связь раскладывается по обоим регистрам', async () => {
    pbMock.getFullList.mockResolvedValue([
      relation('rel01hxyz', {
        parent_incoming_mail_id: MAIL_A,
        child_outgoing_mail_id: MAIL_B,
      }),
    ]);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailRelationIds(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect([...result.current.linkedByType.incoming]).toEqual([MAIL_A]);
    expect([...result.current.linkedByType.outgoing]).toEqual([MAIL_B]);
  });

  it('незаполненный конец связи в карту не попадает', async () => {
    pbMock.getFullList.mockResolvedValue([
      relation('rel01hxyz', { parent_incoming_mail_id: MAIL_A }),
      relation('rel02hxyz', { child_outgoing_mail_id: '' }),
    ]);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailRelationIds(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect([...result.current.linkedByType.incoming]).toEqual([MAIL_A]);
    expect(result.current.linkedByType.outgoing.size).toBe(0);
  });

  it('повторная встреча письма в нескольких связях не двоит его', async () => {
    pbMock.getFullList.mockResolvedValue([
      relation('rel01hxyz', {
        parent_incoming_mail_id: MAIL_A,
        child_incoming_mail_id: MAIL_B,
      }),
      relation('rel02hxyz', {
        parent_incoming_mail_id: MAIL_A,
        child_incoming_mail_id: MAIL_C,
      }),
    ]);
    const client = createClient();
    const { result } = renderHook(() => useOrgMailRelationIds(ORG), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect([...result.current.linkedByType.incoming]).toEqual([MAIL_A, MAIL_B, MAIL_C]);
  });
});

// --- filterByAttachments -----------------------------------------------------

describe('filterByAttachments: отбор по вложениям', () => {
  const items = [{ id: MAIL_A }, { id: MAIL_B }, { id: MAIL_C }];
  const counts = new Map<string, number>([
    [MAIL_A, 2],
    [MAIL_C, 1],
  ]);

  it('режим any ничего не убирает и отдаёт исходный массив', () => {
    const loaded = filterByAttachments(items, counts, 'any', true);

    expect(loaded).toBe(items);
    expect(loaded).toHaveLength(3);
  });

  it('пока организация не загружена, список остаётся целым в любом режиме', () => {
    expect(filterByAttachments(items, counts, 'with', false)).toBe(items);
    expect(filterByAttachments(items, counts, 'without', false)).toBe(items);
  });

  it('with оставляет только письма, у которых есть вложение', () => {
    expect(filterByAttachments(items, counts, 'with', true)).toEqual([{ id: MAIL_A }, { id: MAIL_C }]);
  });

  it('without оставляет только письма без вложений', () => {
    expect(filterByAttachments(items, counts, 'without', true)).toEqual([{ id: MAIL_B }]);
  });

  it('пустая карта не оставляет ничего в режиме with и всех в режиме without', () => {
    const empty = new Map<string, number>();

    expect(filterByAttachments(items, empty, 'with', true)).toEqual([]);
    expect(filterByAttachments(items, empty, 'without', true)).toEqual(items);
  });

  it('запись с пустым именем всё равно считается вложением', () => {
    const countsWithBlankName = new Map<string, number>([[MAIL_A, 1]]);

    expect(filterByAttachments(items, countsWithBlankName, 'with', true)).toEqual([{ id: MAIL_A }]);
  });
});

// --- filterByRelations -------------------------------------------------------

describe('filterByRelations: отбор по связям', () => {
  const items = [{ id: MAIL_A }, { id: MAIL_B }, { id: MAIL_C }];
  const linked = new Set([MAIL_B]);

  it('выключенный фильтр отдаёт исходный массив', () => {
    expect(filterByRelations(items, linked, false)).toBe(items);
  });

  it('включённый фильтр оставляет только связанные письма', () => {
    expect(filterByRelations(items, linked, true)).toEqual([{ id: MAIL_B }]);
  });

  it('при пустом множестве связей включать фильтр нечего', () => {
    expect(filterByRelations(items, new Set<string>(), true)).toEqual([]);
  });
});