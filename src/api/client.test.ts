import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { AUTH_TOKEN_REFRESH_THRESHOLD_SECONDS, pb } from './client';

/**
 * Сторожевой тест на отключённую автоотмену запросов.
 *
 * В SDK поле `enableAutoCancellation` приватное (проверено в
 * `node_modules/pocketbase/dist/pocketbase.es.d.ts`), поэтому проверить его на
 * живом клиенте нельзя — читаем исходник, как это уже делает
 * `mail-page-surfaces.test.ts`.
 *
 * Причина теста: ключ отмены — `(метод) + путь коллекции` без query-параметров,
 * поэтому любой следующий GET в ту же коллекцию глушил предыдущий. На `/mail`
 * три GET в `incoming_mails` стартовали за один тик, реестр уходил в ошибку, а
 * таблица показывала «Писем пока нет». Проверка поведения здесь невозможна: нужен
 * браузер и живой PocketBase, а ловить надо сам факт включения флага обратно.
 */

// Путь берём из `import.meta.dirname`, а не из `new URL(..., import.meta.url)`:
// vitest с jsdom подставляет в `import.meta.url` `http://localhost:3000/...`,
// и `fileURLToPath` на таком URL падает с «The URL must be of scheme file».
const CLIENT_SOURCE = readFileSync(`${import.meta.dirname}/client.ts`, 'utf8');

describe('клиент PocketBase', () => {
  it('автоотмена выключена: ключ отмены не различает query-параметры', () => {
    expect(CLIENT_SOURCE).toContain('pb.autoCancellation(false);');
  });

  it('автоотмена не включается обратно ниже по файлу', () => {
    expect(CLIENT_SOURCE).not.toContain('autoCancellation(true)');
  });
});

const THRESHOLD_SECONDS = AUTH_TOKEN_REFRESH_THRESHOLD_SECONDS;
const AUTH_REFRESH_URL = `${pb.baseUrl}/api/collections/users/auth-refresh`;
const INVOICES_RECORDS_URL = `${pb.baseUrl}/api/collections/invoices/records`;
const AUTH_RECORD = { id: 'user-1', collectionId: 'pbc_users', collectionName: 'users' };

/**
 * `isTokenExpired` смотрит только в payload JWT: `getTokenPayload` берёт
 * `token.split('.')[1]`, декодирует base64 и парсит JSON. Подпись не проверяется,
 * поэтому тестовому токену достаточно корректного второго сегмента.
 */
function makeToken(expiresInSeconds: number): string {
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds, type: 'auth' }),
  );
  return `header.${payload}.signature`;
}

/** Считает вызовы, не подменяя поведение: настоящий метод под ним остаётся. */
function countAuthRefresh() {
  const users = pb.collection('users');
  const real = users.authRefresh.bind(users);
  return vi.spyOn(users, 'authRefresh').mockImplementation((options) => real(options));
}

/**
 * Единственный подменяемый шов — транспорт. MSW перехватывает глобальный
 * `fetch`, поэтому настоящий `authRefresh`, настоящий `Client.send` и настоящий
 * `beforeSend` работают без подмен, а `invoicesAuthorizations` — это ровно те
 * заголовки `Authorization`, которые ушли бы в сеть.
 *
 * `refreshStatus: 500` — намеренно не 401: на 401 сработает ветка разлогина в
 * `afterSend`, и тест проверял бы уже её, а не `beforeSend`.
 */
function mockBackend(renewedToken: string, refreshStatus = 200) {
  const invoicesAuthorizations: string[] = [];
  server.use(
    http.post(AUTH_REFRESH_URL, () =>
      refreshStatus === 200
        ? HttpResponse.json({ token: renewedToken, record: AUTH_RECORD })
        : HttpResponse.json({ message: 'Internal Server Error.' }, { status: refreshStatus }),
    ),
    http.get(INVOICES_RECORDS_URL, ({ request }) => {
      invoicesAuthorizations.push(request.headers.get('Authorization') ?? '');
      return HttpResponse.json({ page: 1, perPage: 1, totalItems: 0, totalPages: 1, items: [] });
    }),
  );
  return { invoicesAuthorizations };
}

describe('упреждающее продление токена (beforeSend)', () => {
  beforeEach(() => {
    pb.authStore.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    pb.authStore.clear();
  });

  it('токен далеко от порога: запрос уходит как есть, продления нет', async () => {
    const token = makeToken(THRESHOLD_SECONDS * 10);
    pb.authStore.save(token, null);
    const { invoicesAuthorizations } = mockBackend(token);
    const authRefresh = countAuthRefresh();

    await pb.collection('invoices').getList(1, 1);

    expect(authRefresh).not.toHaveBeenCalled();
    expect(invoicesAuthorizations).toEqual([token]);
  });

  it('токен у порога: продление ровно одно, и запрос уходит с новым токеном', async () => {
    const staleToken = makeToken(THRESHOLD_SECONDS - 60);
    const renewedToken = makeToken(THRESHOLD_SECONDS * 100);
    pb.authStore.save(staleToken, null);
    const { invoicesAuthorizations } = mockBackend(renewedToken);
    const authRefresh = countAuthRefresh();

    await pb.collection('invoices').getList(1, 1);

    expect(authRefresh).toHaveBeenCalledTimes(1);
    expect(pb.authStore.token).toBe(renewedToken);
    // Регрессия, ради которой существует весь хук: `initSendOptions` штампует
    // `Authorization` ДО `beforeSend`, и без подмены запрос ушёл бы со
    // stale-токеном — тем самым, из-за которого и продлились.
    expect(invoicesAuthorizations).toEqual([renewedToken]);
  });

  it('продление не удалось: запрос всё равно уходит, разлогина нет', async () => {
    const staleToken = makeToken(THRESHOLD_SECONDS - 60);
    pb.authStore.save(staleToken, null);
    const { invoicesAuthorizations } = mockBackend('', 500);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(pb.collection('invoices').getList(1, 1)).resolves.toBeDefined();

    expect(invoicesAuthorizations).toEqual([staleToken]);
    // `beforeSend` не имеет права разлогинивать: это делает ветка 401 в
    // `afterSend` по факту ответа сервера, а не по факту неудачи продления.
    expect(pb.authStore.token).toBe(staleToken);
    expect(warn).toHaveBeenCalled();
  });

  it('guard: запрос самого продления не запускает второе продление', async () => {
    // Токен заведомо у порога — удержать хук от рекурсии может только ранний
    // выход по `query.autoRefresh`. Без него тест падает переполнением стека.
    pb.authStore.save(makeToken(THRESHOLD_SECONDS - 60), null);
    const renewedToken = makeToken(THRESHOLD_SECONDS * 100);
    const refreshHits = vi.fn();
    server.use(
      http.post(AUTH_REFRESH_URL, () => {
        refreshHits();
        return HttpResponse.json({ token: renewedToken, record: AUTH_RECORD });
      }),
    );
    const authRefresh = countAuthRefresh();

    await pb.collection('users').authRefresh({ autoRefresh: true });

    expect(refreshHits).toHaveBeenCalledTimes(1);
    expect(authRefresh).toHaveBeenCalledTimes(1);
    expect(pb.authStore.token).toBe(renewedToken);
  });
});
