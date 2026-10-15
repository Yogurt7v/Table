import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ListResult } from 'pocketbase';
import type {
  IDeletedIncomingMail,
  IDeletedOutgoingMail,
  IIncomingMail,
  IMailFile,
  IMailHistory,
  IMailRelation,
  IOutgoingMail,
  MailListParams,
  MailType,
} from '@/shared/types';
import type { CreateIncomingMailInput, CreateOutgoingMailInput } from '@/api/mail';
import {
  useAllIncomingMails,
  useAllOutgoingMails,
  useCreateIncomingMail,
  useCreateMailRelation,
  useCreateOutgoingMail,
  useDeleteIncomingMail,
  useDeleteMailFile,
  useDeleteMailRelation,
  useDeleteOutgoingMail,
  useDeletedIncomingMails,
  useDeletedOutgoingMails,
  useIncomingMail,
  useIncomingMailHistory,
  useIncomingMails,
  useMailFiles,
  useMailRelations,
  useOutgoingMail,
  useOutgoingMailHistory,
  useOutgoingMails,
  useRestoreDeletedIncomingMail,
  useRestoreDeletedOutgoingMail,
  useUpdateIncomingMail,
  useUpdateOutgoingMail,
  useUploadMailFiles,
} from './useMail';
import type { MailListQuery } from './useMail';

/**
 * Регрессионная сетка для хуков письма.
 *
 * Шов — модульный мок `@/api/mail`. Он выбран целиком: контракт этого файла
 * состоит из трёх вещей, которых нет на HTTP-уровне, — ИМЯ ключа запроса,
 * НАБОР инвалидируемых ключей после мутации и точная проброска аргументов.
 * MSW проверял бы здесь `src/api/mail.ts`, а не `useMail.ts`: фильтры, сортировки
 * и формы запросов уже закрыты на своём уровне (`src/api/mail.filter.test.ts`),
 * а мок, наоборот, даёт ответ на вопрос «какая именно функция вызвана с каким
 * аргументом», на который HTTP-слой ответить не может в принципе.
 *
 * Инвалидация проверяется НЕ подменой `queryClient.invalidateQueries`, а
 * наблюдением: подняты все ключи письма сразу, и после мутации пересчитываются
 * ровно те, чей префикс совпал. Такой тест ловит и забытую инвалидацию, и лишнюю
 * (чужой регистр, чужое письмо, чужая организация), и — что важнее всего —
 * доказывает, что данные реально доехали до живого наблюдателя, а не просто
 * были помечены флагом в пустом кэше.
 */

// --- Моки -------------------------------------------------------------------

/**
 * Подписи моков сняты с `@/api/mail` один в один. Это не косметика: без них
 * `vi.fn()` принимает любую фикстуру, и опечатка в поле письма (или подмена
 * архивной записи живой) осталась бы незамеченной до рантайма.
 */
const api = vi.hoisted(() => ({
  getIncomingMails: vi.fn<(params: MailListParams) => Promise<ListResult<IIncomingMail>>>(),
  getOutgoingMails: vi.fn<(params: MailListParams) => Promise<ListResult<IOutgoingMail>>>(),
  getAllIncomingMails: vi.fn<(params: MailListParams) => Promise<IIncomingMail[]>>(),
  getAllOutgoingMails: vi.fn<(params: MailListParams) => Promise<IOutgoingMail[]>>(),
  getIncomingMail: vi.fn<(id: string) => Promise<IIncomingMail>>(),
  getOutgoingMail: vi.fn<(id: string) => Promise<IOutgoingMail>>(),
  getMailFiles: vi.fn<(mailId: string, mailType: MailType) => Promise<IMailFile[]>>(),
  getIncomingMailHistory: vi.fn<(mailId: string) => Promise<IMailHistory[]>>(),
  getOutgoingMailHistory: vi.fn<(mailId: string) => Promise<IMailHistory[]>>(),
  getIncomingMailRelations: vi.fn<(mailId: string) => Promise<IMailRelation[]>>(),
  getOutgoingMailRelations: vi.fn<(mailId: string) => Promise<IMailRelation[]>>(),
  getDeletedIncomingMails:
    vi.fn<(params: MailListParams) => Promise<ListResult<IDeletedIncomingMail>>>(),
  getDeletedOutgoingMails:
    vi.fn<(params: MailListParams) => Promise<ListResult<IDeletedOutgoingMail>>>(),
  createIncomingMail: vi.fn<(data: CreateIncomingMailInput) => Promise<IIncomingMail>>(),
  createOutgoingMail: vi.fn<(data: CreateOutgoingMailInput) => Promise<IOutgoingMail>>(),
  updateIncomingMail:
    vi.fn<
      (
        id: string,
        data: Partial<IIncomingMail>,
        previousData: Record<string, unknown>,
      ) => Promise<IIncomingMail>
    >(),
  updateOutgoingMail:
    vi.fn<
      (
        id: string,
        data: Partial<IOutgoingMail>,
        previousData: Record<string, unknown>,
      ) => Promise<IOutgoingMail>
    >(),
  deleteIncomingMail: vi.fn<(id: string, reason: string) => Promise<boolean>>(),
  deleteOutgoingMail: vi.fn<(id: string, reason: string) => Promise<boolean>>(),
  restoreDeletedIncomingMail: vi.fn<(deletedMailId: string) => Promise<IIncomingMail>>(),
  restoreDeletedOutgoingMail: vi.fn<(deletedMailId: string) => Promise<IOutgoingMail>>(),
  uploadMailFiles:
    vi.fn<
      (
        mailId: string,
        mailType: MailType,
        organizationId: string,
        files: File[],
      ) => Promise<IMailFile[]>
    >(),
  deleteMailFile: vi.fn<(id: string) => Promise<boolean>>(),
  createIncomingMailRelation:
    vi.fn<(parentId: string, childId: string, organizationId: string) => Promise<IMailRelation>>(),
  createOutgoingMailRelation:
    vi.fn<(parentId: string, childId: string, organizationId: string) => Promise<IMailRelation>>(),
  deleteMailRelation: vi.fn<(relationId: string, organizationId: string) => Promise<void>>(),
}));

vi.mock('@/api/mail', () => api);

const toast = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock('@mantine/notifications', () => ({ notifications: toast }));

// --- Константы и фикстуры ---------------------------------------------------

const ORG = 'org01hxyz';
const OTHER_ORG = 'org02hxyz';
const MAIL_ID = 'mail01hxyz';
const OTHER_MAIL_ID = 'mail02hxyz';
const PARAMS: MailListQuery = { page: 1, perPage: 20 };
const FILE = new File(['payload'], 'Договор.pdf', { type: 'application/pdf' });

function page<T>(items: T[]): ListResult<T> {
  return { page: 1, perPage: 20, totalItems: items.length, totalPages: 1, items };
}

function incomingMail(id: string, org = ORG): IIncomingMail {
  return {
    id,
    organization_id: org,
    date: '2026-03-01',
    subject: 'Тема',
    sender: 'ООО Ромашка',
    responsible: 'user01hxyz',
  };
}

function outgoingMail(id: string, org = ORG): IOutgoingMail {
  return {
    id,
    organization_id: org,
    date: '2026-03-01',
    subject: 'Тема',
    recipient: 'ООО Одуванчик',
    responsible: 'user01hxyz',
    outgoing_number: '7',
  };
}

function mailHistory(id: string): IMailHistory {
  return {
    id,
    organization_id: ORG,
    author: 'user01hxyz',
    changed_at: '2026-03-02T10:00:00.000Z',
    type: 'updated',
    previous_data: {},
  };
}

function mailRelation(id: string, mailId: string): IMailRelation {
  return {
    id,
    parent_incoming_mail_id: mailId,
    organization_id: ORG,
  };
}

function mailFile(id: string, mailId: string, mailType: MailType): IMailFile {
  return {
    id,
    mail_id: mailId,
    mail_type: mailType,
    organization_id: ORG,
    file: [`${id}.pdf`],
    name: `${id}.pdf`,
  };
}

function deletedIncoming(id: string, org = ORG): IDeletedIncomingMail {
  return {
    ...incomingMail(MAIL_ID, org),
    id,
    original_id: MAIL_ID,
    deleted_by: 'user02hxyz',
    deleted_by_name: 'Пётр',
    deleted_at: '2026-04-01T10:00:00.000Z',
  };
}

function deletedOutgoing(id: string, org = ORG): IDeletedOutgoingMail {
  return {
    ...outgoingMail(MAIL_ID, org),
    id,
    original_id: MAIL_ID,
    deleted_by: 'user02hxyz',
    deleted_by_name: 'Пётр',
    deleted_at: '2026-04-01T10:00:00.000Z',
  };
}

// --- Обвязка ----------------------------------------------------------------

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

// --- Счётчики вызовов -------------------------------------------------------

/** Мок функции, первый аргумент которой — параметры списка писем. */
interface RegisterRecorder {
  mock: { calls: readonly [MailListParams][] };
}

/** Мок функции с произвольными позиционными аргументами. */
interface CallRecorder {
  mock: { calls: readonly unknown[][] };
}

/** Сколько раз функцию звали с параметрами конкретной организации. */
function registerCalls(fn: RegisterRecorder, org: string): number {
  return fn.mock.calls.filter(([params]) => params.organizationId === org).length;
}

/** Сколько раз функцию звали ровно с этой последовательностью аргументов. */
function callsWith(fn: CallRecorder, ...args: unknown[]): number {
  return fn.mock.calls.filter((call) => args.every((arg, index) => call[index] === arg)).length;
}

// --- Наблюдатели ключей -----------------------------------------------------

interface Observer {
  /** Имя наблюдателя: оно же ключ в объекте ожиданий пересчёта. */
  readonly name: string;
  /** Сколько раз наблюдатель ушёл в API — один на каждую перезагрузку. */
  readonly calls: () => number;
}

/**
 * Полный список для клиентского поиска не перечитывает НИ ОДНА мутация письма:
 * ключ `incomingMailsAll` не входит ни в один `invalidateQueries`. Пока это
 * выглядит как дыра (в режиме поиска удалённое письмо остаётся в выдаче —
 * см. отчёт по этой задаче), но это не контракт, который тест имеет право
 * закреплять, поэтому два наблюдателя выведены из проверок пересчёта.
 */
const UNDECIDED = new Set(['полный список входящих', 'полный список исходящих']);

const OBSERVERS: readonly Observer[] = [
  {
    name: 'реестр входящих',
    calls: () => registerCalls(api.getIncomingMails, ORG),
  },
  {
    name: 'реестр входящих чужой орг',
    calls: () => registerCalls(api.getIncomingMails, OTHER_ORG),
  },
  { name: 'реестр исходящих', calls: () => registerCalls(api.getOutgoingMails, ORG) },
  {
    name: 'архив входящих',
    calls: () => registerCalls(api.getDeletedIncomingMails, ORG),
  },
  {
    name: 'архив исходящих',
    calls: () => registerCalls(api.getDeletedOutgoingMails, ORG),
  },
  { name: 'полный список входящих', calls: () => registerCalls(api.getAllIncomingMails, ORG) },
  { name: 'полный список исходящих', calls: () => registerCalls(api.getAllOutgoingMails, ORG) },
  { name: 'карточка входящего', calls: () => callsWith(api.getIncomingMail, MAIL_ID) },
  {
    name: 'чужая карточка входящего',
    calls: () => callsWith(api.getIncomingMail, OTHER_MAIL_ID),
  },
  { name: 'карточка исходящего', calls: () => callsWith(api.getOutgoingMail, MAIL_ID) },
  { name: 'история входящего', calls: () => callsWith(api.getIncomingMailHistory, MAIL_ID) },
  {
    name: 'чужая история входящего',
    calls: () => callsWith(api.getIncomingMailHistory, OTHER_MAIL_ID),
  },
  {
    name: 'история исходящего',
    calls: () => callsWith(api.getOutgoingMailHistory, MAIL_ID),
  },
  {
    name: 'связи входящего',
    calls: () => callsWith(api.getIncomingMailRelations, MAIL_ID),
  },
  {
    name: 'связи второго входящего',
    calls: () => callsWith(api.getIncomingMailRelations, OTHER_MAIL_ID),
  },
  {
    name: 'связи исходящего',
    calls: () => callsWith(api.getOutgoingMailRelations, MAIL_ID),
  },
  {
    name: 'вложения входящего',
    calls: () => callsWith(api.getMailFiles, MAIL_ID, 'incoming'),
  },
  {
    name: 'вложения исходящего',
    calls: () => callsWith(api.getMailFiles, MAIL_ID, 'outgoing'),
  },
  {
    name: 'чужие вложения входящего',
    calls: () => callsWith(api.getMailFiles, OTHER_MAIL_ID, 'incoming'),
  },
];

/**
 * Все наблюдаемые ключи подняты одним компонентом: `invalidateQueries`
 * перечитывает только АКТИВНЫЕ запросы, поэтому забытый наблюдатель сделал бы
 * проверку неполной, а не более строгой.
 */
function MailCaches() {
  useIncomingMails(ORG, PARAMS);
  useIncomingMails(OTHER_ORG, PARAMS);
  useOutgoingMails(ORG, PARAMS);
  useDeletedIncomingMails(ORG, PARAMS);
  useDeletedOutgoingMails(ORG, PARAMS);
  useAllIncomingMails(ORG, PARAMS);
  useAllOutgoingMails(ORG, PARAMS);
  useIncomingMail(MAIL_ID);
  useIncomingMail(OTHER_MAIL_ID);
  useOutgoingMail(MAIL_ID);
  useIncomingMailHistory(MAIL_ID);
  useIncomingMailHistory(OTHER_MAIL_ID);
  useOutgoingMailHistory(MAIL_ID);
  useMailRelations(MAIL_ID, 'incoming');
  useMailRelations(OTHER_MAIL_ID, 'incoming');
  useMailRelations(MAIL_ID, 'outgoing');
  useMailFiles(MAIL_ID, 'incoming');
  useMailFiles(MAIL_ID, 'outgoing');
  useMailFiles(OTHER_MAIL_ID, 'incoming');
  return null;
}

function totalApiCalls(): number {
  return Object.values(api).reduce((sum, fn) => sum + fn.mock.calls.length, 0);
}

/** Поднимает дерево наблюдателей и дожидается первого чтения по каждому ключу. */
async function mountCaches(client: QueryClient): Promise<void> {
  render(createElement(MailCaches), { wrapper: wrapperFor(client) });
  // Счёт по числу вызовов ловит рассинхрон в обе стороны: и лишний, не описанный
  // в OBSERVERS хук, и наблюдатель, который забыли поднять.
  await waitFor(() => expect(totalApiCalls()).toBe(OBSERVERS.length));
  for (const observer of OBSERVERS) {
    expect(observer.calls(), observer.name).toBe(1);
  }
}

/**
 * После мутации перечитываются ровно те наблюдатели, чей префикс ключа совпал с
 * одним из `invalidateQueries`. Не названные в `expected` обязаны остаться на
 * единице — иначе тест поймал бы лишнюю инвалидацию (чужой регистр, чужое
 * письмо, другая организация), а не пропущенную.
 */
async function expectRefetched(expected: Record<string, number>): Promise<void> {
  const names = OBSERVERS.map((observer) => observer.name);
  for (const name of Object.keys(expected)) {
    expect(names, `в ожиданиях есть неизвестный наблюдатель «${name}»`).toContain(name);
  }
  await waitFor(() => {
    for (const observer of OBSERVERS) {
      if (UNDECIDED.has(observer.name)) continue;
      expect(observer.calls(), observer.name).toBe(expected[observer.name] ?? 1);
    }
  });
}

// --- Фикстуры по умолчанию --------------------------------------------------

beforeEach(() => {
  // Счётчики вызовов копятся между тестами, а проверка пересчёта сравнивает их
  // с единицей — без сброса второй тест видел бы историю первого. Именно
  // `resetAllMocks`, а не `clearAllMocks`: только он вычищает очередь
  // `mockImplementationOnce`, и подвисшая однажды заглушка не утекла бы в
  // следующий тест. Все реализации проставляются ниже заново.
  vi.resetAllMocks();

  api.getIncomingMails.mockImplementation((params: MailListParams) =>
    Promise.resolve(page([incomingMail(`in-${params.organizationId}`, params.organizationId)])),
  );
  api.getOutgoingMails.mockImplementation((params: MailListParams) =>
    Promise.resolve(page([outgoingMail(`out-${params.organizationId}`, params.organizationId)])),
  );
  api.getAllIncomingMails.mockImplementation((params: MailListParams) =>
    Promise.resolve([incomingMail(`all-in-${params.organizationId}`, params.organizationId)]),
  );
  api.getAllOutgoingMails.mockImplementation((params: MailListParams) =>
    Promise.resolve([outgoingMail(`all-out-${params.organizationId}`, params.organizationId)]),
  );
  api.getIncomingMail.mockImplementation((id) => Promise.resolve(incomingMail(id)));
  api.getOutgoingMail.mockImplementation((id) => Promise.resolve(outgoingMail(id)));
  api.getMailFiles.mockImplementation((mailId, mailType) =>
    Promise.resolve([mailFile(`${mailType}-${mailId}`, mailId, mailType)]),
  );
  api.getIncomingMailHistory.mockImplementation((mailId) =>
    Promise.resolve([mailHistory(`hist-${mailId}`)]),
  );
  api.getOutgoingMailHistory.mockImplementation((mailId) =>
    Promise.resolve([mailHistory(`hist-out-${mailId}`)]),
  );
  api.getIncomingMailRelations.mockImplementation((mailId) =>
    Promise.resolve([mailRelation(`rel-${mailId}`, mailId)]),
  );
  api.getOutgoingMailRelations.mockImplementation((mailId) =>
    Promise.resolve([mailRelation(`rel-out-${mailId}`, mailId)]),
  );
  api.getDeletedIncomingMails.mockImplementation((params) =>
    Promise.resolve(page([deletedIncoming(`del-${params.organizationId}`, params.organizationId)])),
  );
  api.getDeletedOutgoingMails.mockImplementation((params) =>
    Promise.resolve(
      page([deletedOutgoing(`del-out-${params.organizationId}`, params.organizationId)]),
    ),
  );

  api.createIncomingMail.mockImplementation(() => Promise.resolve(incomingMail(MAIL_ID)));
  api.createOutgoingMail.mockImplementation(() => Promise.resolve(outgoingMail(MAIL_ID)));
  api.updateIncomingMail.mockImplementation(() => Promise.resolve(incomingMail(MAIL_ID)));
  api.updateOutgoingMail.mockImplementation(() => Promise.resolve(outgoingMail(MAIL_ID)));
  api.deleteIncomingMail.mockResolvedValue(true);
  api.deleteOutgoingMail.mockResolvedValue(true);
  api.restoreDeletedIncomingMail.mockImplementation(() => Promise.resolve(incomingMail(MAIL_ID)));
  api.restoreDeletedOutgoingMail.mockImplementation(() => Promise.resolve(outgoingMail(MAIL_ID)));
  api.uploadMailFiles.mockResolvedValue([]);
  api.deleteMailFile.mockResolvedValue(true);
  api.createIncomingMailRelation.mockImplementation((parentId) =>
    Promise.resolve(mailRelation('rel-new', parentId)),
  );
  api.createOutgoingMailRelation.mockImplementation((parentId) =>
    Promise.resolve(mailRelation('rel-new', parentId)),
  );
  api.deleteMailRelation.mockResolvedValue(undefined);
});

/*
 * Отдельного `afterEach` здесь нет намеренно. Единственное состояние, которое
 * переживает тест, — счётчики вызовов моков, и они обнуляются в `beforeEach`
 * (см. там же, почему нужен `resetAllMocks`), а кэш умирает вместе с клиентом,
 * который каждый тест создаёт заново.
 *
 * Модульные реестры `last-known-user` и `pb.authStore`, которые утекают между
 * файлами в соседних наборах, в этом воркере просто НЕ ЗАГРУЖАЮТСЯ: `@/api/mail`
 * заглушен целиком, а `useMail.ts` больше ничего из `@/api/` не импортирует.
 * Сбрасывать нечего — и добавлять `setLastKnownUser(null)`/`pb.authStore.clear()`
 * было бы приписыванием кода, которого в этом графе нет.
 */

// --- Ключи запросов ---------------------------------------------------------

describe('Запросы письма: ключ и параметры', () => {
  it('useIncomingMails читает данные по ключу [incomingMails, org, params]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useIncomingMails(ORG, PARAMS), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getIncomingMails).toHaveBeenCalledWith({ ...PARAMS, organizationId: ORG });
    expect(result.current.data?.items.map((mail) => mail.id)).toEqual([`in-${ORG}`]);
    expect(client.getQueryData(['incomingMails', ORG, PARAMS])).toBe(result.current.data);
  });

  it('useOutgoingMails читает данные по ключу [outgoingMails, org, params]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useOutgoingMails(ORG, PARAMS), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getOutgoingMails).toHaveBeenCalledWith({ ...PARAMS, organizationId: ORG });
    expect(result.current.data?.items.map((mail) => mail.id)).toEqual([`out-${ORG}`]);
    expect(client.getQueryData(['outgoingMails', ORG, PARAMS])).toBe(result.current.data);
  });

  it('useAllIncomingMails не делит ключ с реестром страниц', async () => {
    const client = createClient();
    const { result } = renderHook(() => useAllIncomingMails(ORG, PARAMS), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getAllIncomingMails).toHaveBeenCalledWith({ ...PARAMS, organizationId: ORG });
    expect(result.current.data?.map((mail) => mail.id)).toEqual([`all-in-${ORG}`]);
    expect(client.getQueryData(['incomingMailsAll', ORG, PARAMS])).toBe(result.current.data);
  });

  it('useAllOutgoingMails не делит ключ с реестром страниц', async () => {
    const client = createClient();
    const { result } = renderHook(() => useAllOutgoingMails(ORG, PARAMS), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getAllOutgoingMails).toHaveBeenCalledWith({ ...PARAMS, organizationId: ORG });
    expect(result.current.data?.map((mail) => mail.id)).toEqual([`all-out-${ORG}`]);
    expect(client.getQueryData(['outgoingMailsAll', ORG, PARAMS])).toBe(result.current.data);
  });

  it('useDeletedIncomingMails читает архив по ключу [deletedIncomingMails, org, params]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useDeletedIncomingMails(ORG, PARAMS), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getDeletedIncomingMails).toHaveBeenCalledWith({ ...PARAMS, organizationId: ORG });
    expect(result.current.data?.items.map((mail) => mail.id)).toEqual([`del-${ORG}`]);
    expect(client.getQueryData(['deletedIncomingMails', ORG, PARAMS])).toBe(result.current.data);
  });

  it('useDeletedOutgoingMails читает архив по ключу [deletedOutgoingMails, org, params]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useDeletedOutgoingMails(ORG, PARAMS), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getDeletedOutgoingMails).toHaveBeenCalledWith({ ...PARAMS, organizationId: ORG });
    expect(result.current.data?.items.map((mail) => mail.id)).toEqual([`del-out-${ORG}`]);
    expect(client.getQueryData(['deletedOutgoingMails', ORG, PARAMS])).toBe(result.current.data);
  });

  it('useIncomingMail читает карточку по ключу [incomingMail, id]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useIncomingMail(MAIL_ID), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getIncomingMail).toHaveBeenCalledWith(MAIL_ID);
    expect(result.current.data?.id).toBe(MAIL_ID);
    expect(client.getQueryData(['incomingMail', MAIL_ID])).toBe(result.current.data);
  });

  it('useOutgoingMail читает карточку по ключу [outgoingMail, id]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useOutgoingMail(MAIL_ID), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getOutgoingMail).toHaveBeenCalledWith(MAIL_ID);
    expect(result.current.data?.id).toBe(MAIL_ID);
    expect(client.getQueryData(['outgoingMail', MAIL_ID])).toBe(result.current.data);
  });

  it('useMailFiles различает вложения письма по ключу [mailFiles, id, type]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useMailFiles(MAIL_ID, 'incoming'), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getMailFiles).toHaveBeenCalledWith(MAIL_ID, 'incoming');
    expect(result.current.data?.map((file) => file.id)).toEqual([`incoming-${MAIL_ID}`]);
    expect(client.getQueryData(['mailFiles', MAIL_ID, 'incoming'])).toBe(result.current.data);
  });

  it('useIncomingMailHistory читает историю по ключу [incomingMailHistory, id]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useIncomingMailHistory(MAIL_ID), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getIncomingMailHistory).toHaveBeenCalledWith(MAIL_ID);
    expect(result.current.data?.map((entry) => entry.id)).toEqual([`hist-${MAIL_ID}`]);
    expect(client.getQueryData(['incomingMailHistory', MAIL_ID])).toBe(result.current.data);
  });

  it('useOutgoingMailHistory читает историю по ключу [outgoingMailHistory, id]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useOutgoingMailHistory(MAIL_ID), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getOutgoingMailHistory).toHaveBeenCalledWith(MAIL_ID);
    expect(result.current.data?.map((entry) => entry.id)).toEqual([`hist-out-${MAIL_ID}`]);
    expect(client.getQueryData(['outgoingMailHistory', MAIL_ID])).toBe(result.current.data);
  });

  it('useMailRelations выбирает функцию регистра по mailType и ключу [mailRelations, id, type]', async () => {
    const client = createClient();
    const { result } = renderHook(() => useMailRelations(MAIL_ID, 'outgoing'), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getOutgoingMailRelations).toHaveBeenCalledWith(MAIL_ID);
    expect(api.getIncomingMailRelations).not.toHaveBeenCalled();
    expect(result.current.data?.map((relation) => relation.id)).toEqual([`rel-out-${MAIL_ID}`]);
    expect(client.getQueryData(['mailRelations', MAIL_ID, 'outgoing'])).toBe(result.current.data);
  });

  it('пустой id письма не читается: карточка, история, связи и вложения ждут id', async () => {
    const client = createClient();
    renderHook(
      () => {
        useIncomingMail('');
        useIncomingMailHistory('');
        useMailRelations('', 'incoming');
        useMailFiles('', 'incoming');
      },
      { wrapper: wrapperFor(client) },
    );

    // Даём кадр на микро-задачи: запрос был бы отправлен уже на первом проходе.
    await act(async () => {
      await Promise.resolve();
    });
    expect(totalApiCalls()).toBe(0);
  });

  it('пустая организация не читается: ни один реестр и архив не качаются', async () => {
    const client = createClient();
    renderHook(
      () => {
        useIncomingMails('', PARAMS);
        useOutgoingMails('', PARAMS);
        useDeletedIncomingMails('', PARAMS);
        useDeletedOutgoingMails('', PARAMS);
        useAllIncomingMails('', PARAMS, true);
      },
      { wrapper: wrapperFor(client) },
    );

    expect(api.getIncomingMails).not.toHaveBeenCalled();
    expect(api.getOutgoingMails).not.toHaveBeenCalled();
    expect(api.getDeletedIncomingMails).not.toHaveBeenCalled();
    expect(api.getDeletedOutgoingMails).not.toHaveBeenCalled();
    expect(api.getAllIncomingMails).not.toHaveBeenCalled();
  });

  it('пустой поиск не включает полный список: флаг enabled выключает чтение', async () => {
    const client = createClient();
    const { result } = renderHook(() => useAllIncomingMails(ORG, PARAMS, false), {
      wrapper: wrapperFor(client),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(api.getAllIncomingMails).not.toHaveBeenCalled();
  });

  it('две организации не делят запись реестра', async () => {
    const client = createClient();
    renderHook(
      () => {
        useIncomingMails(ORG, PARAMS);
        useIncomingMails(OTHER_ORG, PARAMS);
      },
      { wrapper: wrapperFor(client) },
    );
    await waitFor(() => expect(registerCalls(api.getIncomingMails, ORG)).toBe(1));

    expect(client.getQueryData(['incomingMails', ORG, PARAMS])).not.toBe(
      client.getQueryData(['incomingMails', OTHER_ORG, PARAMS]),
    );
  });

  it('смена страницы не гасит таблицу: прошлая страница остаётся на экране', async () => {
    const client = createClient();
    const { result, rerender } = renderHook(
      ({ params }: { params: MailListQuery }) => useIncomingMails(ORG, params),
      { wrapper: wrapperFor(client), initialProps: { params: PARAMS } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Вторая страница ещё летит — `keepPreviousData` обязан оставить первую.
    api.getIncomingMails.mockImplementationOnce(
      () => new Promise(() => {}) as unknown as Promise<ListResult<IIncomingMail>>,
    );
    rerender({ params: { ...PARAMS, page: 2 } });

    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.items.map((mail) => mail.id)).toEqual([`in-${ORG}`]);
  });
});

// --- Инвалидация ------------------------------------------------------------

describe('Мутации письма: что именно перечитывается', () => {
  it('useCreateIncomingMail перечитывает только реестр входящих', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useCreateIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        organization_id: ORG,
        date: '2026-03-01',
        subject: 'Т',
        sender: 'ООО',
        responsible: 'u',
      });
    });

    await expectRefetched({ 'реестр входящих': 2 });
  });

  it('useCreateOutgoingMail перечитывает только реестр исходящих', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useCreateOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        organization_id: ORG,
        date: '2026-03-01',
        subject: 'Т',
        recipient: 'ООО',
        responsible: 'u',
        outgoing_number: '7',
      });
    });

    await expectRefetched({ 'реестр исходящих': 2 });
  });

  it('useUpdateIncomingMail перечитывает реестр, карточку, историю и связи письма', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useUpdateIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: MAIL_ID, data: {}, previousData: {} });
    });

    await expectRefetched({
      'реестр входящих': 2,
      'карточка входящего': 2,
      'история входящего': 2,
      'связи входящего': 2,
    });
  });

  it('useUpdateOutgoingMail перечитывает реестр, карточку, историю и связи письма', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useUpdateOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: MAIL_ID, data: {}, previousData: {} });
    });

    await expectRefetched({
      'реестр исходящих': 2,
      'карточка исходящего': 2,
      'история исходящего': 2,
      'связи исходящего': 2,
    });
  });

  it('useDeleteIncomingMail перечитывает и реестр, и архив удалённых', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useDeleteIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: MAIL_ID, reason: 'счёт создан ошибочно' });
    });

    await expectRefetched({
      'реестр входящих': 2,
      'архив входящих': 2,
      'карточка входящего': 2,
      'история входящего': 2,
      'связи входящего': 2,
    });
  });

  it('useDeleteOutgoingMail перечитывает и реестр, и архив удалённых', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useDeleteOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: MAIL_ID, reason: 'дубль' });
    });

    await expectRefetched({
      'реестр исходящих': 2,
      'архив исходящих': 2,
      'карточка исходящего': 2,
      'история исходящего': 2,
      'связи исходящего': 2,
    });
  });

  it('useRestoreDeletedIncomingMail возвращает письмо в реестр и убирает из архива', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useRestoreDeletedIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync('del01hxyz');
    });

    // История перечитывается ЦЕЛИКОМ (`['incomingMailHistory']` без id): архивная
    // строка не знает id восстановленного письма, а угадывать его нельзя.
    // Карточка письма при этом не трогается — ровно потому, что id неизвестен.
    await expectRefetched({
      'реестр входящих': 2,
      'архив входящих': 2,
      'история входящего': 2,
      'чужая история входящего': 2,
      'карточка входящего': 1,
    });
  });

  it('useRestoreDeletedOutgoingMail возвращает письмо в реестр и убирает из архива', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useRestoreDeletedOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync('del02hxyz');
    });

    await expectRefetched({
      'реестр исходящих': 2,
      'архив исходящих': 2,
      'история исходящего': 2,
      'карточка исходящего': 1,
    });
  });

  it('useUploadMailFiles перечитывает вложения письма и оба реестра', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useUploadMailFiles(ORG), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync({ mailId: MAIL_ID, mailType: 'incoming', files: [FILE] });
    });

    // `withFiles` сужает уже скачанную страницу на клиенте, поэтому оба реестра
    // обязаны перечитаться; вложения другого регистра при этом не трогаются.
    await expectRefetched({
      'вложения входящего': 2,
      'реестр входящих': 2,
      'реестр исходящих': 2,
      'вложения исходящего': 1,
    });
  });

  it('useDeleteMailFile перечитывает вложения того письма, которому файл принадлежит', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useDeleteMailFile(ORG), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync(mailFile('file01hxyz', MAIL_ID, 'incoming'));
    });

    // Ключ вложений собирается из полей самой записи файла, а не из аргументов
    // хука: если бы он был `['mailFiles', orgId]`, снесённый файл остался бы в
    // модалке другого письма.
    await expectRefetched({
      'вложения входящего': 2,
      'реестр входящих': 2,
      'реестр исходящих': 2,
      'чужие вложения входящего': 1,
    });
  });

  it('useCreateMailRelation перечитывает связи обоих концов и историю регистра', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useCreateMailRelation(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        parentId: MAIL_ID,
        childId: OTHER_MAIL_ID,
        mailType: 'incoming',
      });
    });

    await expectRefetched({
      'связи входящего': 2,
      'связи второго входящего': 2,
      'история входящего': 2,
      'чужая история входящего': 2,
      'связи исходящего': 1,
      'история исходящего': 1,
    });
  });

  it('useDeleteMailRelation перечитывает связи всех писем: оба конца известны только в API', async () => {
    const client = createClient();
    await mountCaches(client);
    const { result } = renderHook(() => useDeleteMailRelation(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ relationId: 'rel01hxyz', mailType: 'incoming' });
    });

    // Ключ `['mailRelations']` без id — осознанно: второй конец связи известен
    // только после чтения строки связи, поэтому подписывается весь граф.
    await expectRefetched({
      'связи входящего': 2,
      'связи второго входящего': 2,
      'связи исходящего': 2,
      'история входящего': 2,
      'чужая история входящего': 2,
      'история исходящего': 1,
      'реестр входящих': 1,
      'реестр исходящих': 1,
    });
  });

  it('упавшее удаление всё равно перечитывает реестр и архив', async () => {
    const client = createClient();
    await mountCaches(client);
    api.deleteIncomingMail.mockRejectedValue(new Error('server down'));
    const { result } = renderHook(() => useDeleteIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: MAIL_ID, reason: 'дубль' })).rejects.toThrow(
        'server down',
      );
    });

    // Инвалидация висит на `onSettled`, а не на `onSuccess`: сервер мог успеть
    // заархивировать письмо и упасть на ответе — реестр обязан перечитаться.
    await expectRefetched({
      'реестр входящих': 2,
      'архив входящих': 2,
      'карточка входящего': 2,
      'история входящего': 2,
      'связи входящего': 2,
    });
  });
});

// --- Проброс аргументов -----------------------------------------------------

describe('Мутации письма: аргументы уходят в API без изменений', () => {
  it('useCreateIncomingMail отдаёт тело письма как есть', async () => {
    const client = createClient();
    const payload = {
      organization_id: ORG,
      date: '2026-03-01',
      subject: 'Тема',
      sender: 'ООО Ромашка',
      responsible: 'user01hxyz',
    };
    const { result } = renderHook(() => useCreateIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(api.createIncomingMail).toHaveBeenCalledTimes(1);
    expect(api.createIncomingMail).toHaveBeenCalledWith(payload);
  });

  it('useCreateOutgoingMail отдаёт тело письма как есть', async () => {
    const client = createClient();
    const payload = {
      organization_id: ORG,
      date: '2026-03-01',
      subject: 'Тема',
      recipient: 'ООО Одуванчик',
      responsible: 'user01hxyz',
      outgoing_number: '7',
    };
    const { result } = renderHook(() => useCreateOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(api.createOutgoingMail).toHaveBeenCalledTimes(1);
    expect(api.createOutgoingMail).toHaveBeenCalledWith(payload);
  });

  it('useUpdateIncomingMail разносит id, изменения и снимок по трём позициям', async () => {
    const client = createClient();
    const { result } = renderHook(() => useUpdateIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: MAIL_ID,
        data: { subject: 'Новая тема' },
        previousData: { subject: 'Старая тема' },
      });
    });

    expect(api.updateIncomingMail).toHaveBeenCalledWith(
      MAIL_ID,
      { subject: 'Новая тема' },
      { subject: 'Старая тема' },
    );
  });

  it('useUpdateOutgoingMail разносит id, изменения и снимок по трём позициям', async () => {
    const client = createClient();
    const { result } = renderHook(() => useUpdateOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: MAIL_ID,
        data: { recipient: 'ООО Тюльпан' },
        previousData: { recipient: 'ООО Одуванчик' },
      });
    });

    expect(api.updateOutgoingMail).toHaveBeenCalledWith(
      MAIL_ID,
      { recipient: 'ООО Тюльпан' },
      { recipient: 'ООО Одуванчик' },
    );
  });

  it('useDeleteIncomingMail отдаёт id и причину отдельными аргументами', async () => {
    const client = createClient();
    const { result } = renderHook(() => useDeleteIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: MAIL_ID, reason: 'письмо продублировано' });
    });

    expect(api.deleteIncomingMail).toHaveBeenCalledWith(MAIL_ID, 'письмо продублировано');
  });

  it('useDeleteOutgoingMail отдаёт id и причину отдельными аргументами', async () => {
    const client = createClient();
    const { result } = renderHook(() => useDeleteOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: MAIL_ID, reason: 'письмо продублировано' });
    });

    expect(api.deleteOutgoingMail).toHaveBeenCalledWith(MAIL_ID, 'письмо продублировано');
  });

  it('useRestoreDeletedIncomingMail отдаёт id АРХИВНОЙ записи, а не письма', async () => {
    const client = createClient();
    const { result } = renderHook(() => useRestoreDeletedIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync('del01hxyz');
    });

    expect(api.restoreDeletedIncomingMail).toHaveBeenCalledWith('del01hxyz');
  });

  it('useRestoreDeletedOutgoingMail отдаёт id АРХИВНОЙ записи, а не письма', async () => {
    const client = createClient();
    const { result } = renderHook(() => useRestoreDeletedOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync('del02hxyz');
    });

    expect(api.restoreDeletedOutgoingMail).toHaveBeenCalledWith('del02hxyz');
  });

  it('useUploadMailFiles ставит организацию третьим аргументом, а файлы четвёртым', async () => {
    const client = createClient();
    const { result } = renderHook(() => useUploadMailFiles(ORG), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync({ mailId: MAIL_ID, mailType: 'incoming', files: [FILE] });
    });

    // Порядок аргументов у `uploadMailFiles(mailId, mailType, organizationId, files)`
    // неочевиден: организация идёт третьей, а файлы — четвёртыми.
    expect(api.uploadMailFiles).toHaveBeenCalledWith(MAIL_ID, 'incoming', ORG, [FILE]);
  });

  it('useDeleteMailFile отдаёт id самой записи файла', async () => {
    const client = createClient();
    const { result } = renderHook(() => useDeleteMailFile(ORG), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync(mailFile('file01hxyz', OTHER_MAIL_ID, 'outgoing'));
    });

    expect(api.deleteMailFile).toHaveBeenCalledWith('file01hxyz');
  });

  it('useCreateMailRelation выбирает функцию регистра по mailType', async () => {
    const client = createClient();
    const { result } = renderHook(() => useCreateMailRelation(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        parentId: MAIL_ID,
        childId: OTHER_MAIL_ID,
        mailType: 'outgoing',
      });
    });

    expect(api.createOutgoingMailRelation).toHaveBeenCalledWith(MAIL_ID, OTHER_MAIL_ID, ORG);
    expect(api.createIncomingMailRelation).not.toHaveBeenCalled();
  });

  it('useDeleteMailRelation отдаёт id связи и организацию', async () => {
    const client = createClient();
    const { result } = renderHook(() => useDeleteMailRelation(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ relationId: 'rel01hxyz', mailType: 'incoming' });
    });

    expect(api.deleteMailRelation).toHaveBeenCalledWith('rel01hxyz', ORG);
  });
});

// --- Ошибки -----------------------------------------------------------------

describe('Мутации письма: отказ доходит до вызывающего с русским текстом', () => {
  it('useCreateIncomingMail', async () => {
    const client = createClient();
    api.createIncomingMail.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCreateIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          organization_id: ORG,
          date: '2026-03-01',
          subject: 'Т',
          sender: 'ООО',
          responsible: 'u',
        }),
      ).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось создать входящее письмо',
    });
  });

  it('useCreateOutgoingMail', async () => {
    const client = createClient();
    api.createOutgoingMail.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCreateOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          organization_id: ORG,
          date: '2026-03-01',
          subject: 'Т',
          recipient: 'ООО',
          responsible: 'u',
          outgoing_number: '7',
        }),
      ).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось создать исходящее письмо',
    });
  });

  it('useUpdateIncomingMail', async () => {
    const client = createClient();
    api.updateIncomingMail.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useUpdateIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: MAIL_ID, data: {}, previousData: {} }),
      ).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось сохранить входящее письмо',
    });
  });

  it('useUpdateOutgoingMail', async () => {
    const client = createClient();
    api.updateOutgoingMail.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useUpdateOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: MAIL_ID, data: {}, previousData: {} }),
      ).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось сохранить исходящее письмо',
    });
  });

  it('useDeleteIncomingMail', async () => {
    const client = createClient();
    api.deleteIncomingMail.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDeleteIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: MAIL_ID, reason: 'дубль' })).rejects.toThrow(
        'boom',
      );
    });

    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось удалить входящее письмо',
    });
  });

  it('useDeleteOutgoingMail', async () => {
    const client = createClient();
    api.deleteOutgoingMail.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDeleteOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: MAIL_ID, reason: 'дубль' })).rejects.toThrow(
        'boom',
      );
    });

    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось удалить исходящее письмо',
    });
  });

  it('useRestoreDeletedIncomingMail', async () => {
    const client = createClient();
    api.restoreDeletedIncomingMail.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useRestoreDeletedIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('del01hxyz')).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось восстановить входящее письмо',
    });
  });

  it('useRestoreDeletedOutgoingMail', async () => {
    const client = createClient();
    api.restoreDeletedOutgoingMail.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useRestoreDeletedOutgoingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('del02hxyz')).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось восстановить исходящее письмо',
    });
  });

  it('useUploadMailFiles', async () => {
    const client = createClient();
    api.uploadMailFiles.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useUploadMailFiles(ORG), { wrapper: wrapperFor(client) });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ mailId: MAIL_ID, mailType: 'incoming', files: [FILE] }),
      ).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось загрузить вложения',
    });
  });

  it('useDeleteMailFile', async () => {
    const client = createClient();
    api.deleteMailFile.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDeleteMailFile(ORG), { wrapper: wrapperFor(client) });

    await act(async () => {
      await expect(
        result.current.mutateAsync(mailFile('file01hxyz', MAIL_ID, 'incoming')),
      ).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'Не удалось удалить вложение',
    });
  });

  it('useCreateMailRelation', async () => {
    const client = createClient();
    api.createIncomingMailRelation.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCreateMailRelation(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          parentId: MAIL_ID,
          childId: OTHER_MAIL_ID,
          mailType: 'incoming',
        }),
      ).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledWith({ color: 'red', message: 'Не удалось связать письма' });
  });

  it('useDeleteMailRelation', async () => {
    const client = createClient();
    api.deleteMailRelation.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDeleteMailRelation(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ relationId: 'rel01hxyz', mailType: 'incoming' }),
      ).rejects.toThrow('boom');
    });

    expect(toast.show).toHaveBeenCalledWith({ color: 'red', message: 'Не удалось удалить связь' });
  });

  it('успешная мутация не показывает красный тост', async () => {
    const client = createClient();
    const { result } = renderHook(() => useDeleteIncomingMail(ORG), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: MAIL_ID, reason: 'дубль' });
    });

    expect(toast.show).not.toHaveBeenCalled();
  });
});
