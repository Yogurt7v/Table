import PocketBase, { isTokenExpired } from 'pocketbase';

const API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8090' : window.location.origin;

export const pb = new PocketBase(API_URL);

/**
 * Порог упреждающего обновления токена, в секундах.
 *
 * TTL токена — 7 суток (`604800`): столько поставила миграция `1815000012_*`,
 * поднявшая срок с 24 часов (`86400`), которые до неё выставляла миграция
 * `1811000000_*`. Неделя сильно длиннее рабочего дня, поэтому на запас перед
 * истечением хватает 6 часов.
 *
 * Механика простая: `authRefresh` срабатывает на первом запросе, сделанном
 * после того, как до истечения токена осталось не больше порога, и выдаёт
 * новый токен с новым семидневным сроком. Значит при непрерывной работе
 * обновление уходит примерно раз в `604800 - 21600 = 583200` секунд — около
 * 6,75 суток, то есть примерно раз в неделю.
 *
 * Ночной перерыв ничего не меняет: после 8 часов простоя у семидневного токена
 * остаётся ~6 суток 16 часов, до порога далеко, так что «продления после ночи»
 * не случается. Обновление приходит только когда до истечения реально осталось
 * меньше 6 часов.
 *
 * Смысл порога ровно в этом — поймать момент заранее, но не на каждом запросе.
 * Его реальная цена — один запрос к auth-эндпоинту примерно раз в 6,75 суток
 * непрерывной работы.
 */
export const AUTH_TOKEN_REFRESH_THRESHOLD_SECONDS = 21600;

/**
 * Упреждающее продление токена перед каждым запросом.
 *
 * Проблема, которую это чинит: `authRefresh` умеет продлевать только ещё живой
 * токен. Как только он просрочен, сервер отвечает 401, `afterSend` вызывает
 * `authStore.clear()`, `AuthContext.onChange` ставит `user = null` — и человек
 * посреди работы оказывается на `/login`. Спасти уже просроченный токен из
 * клиента нечем: пароля у клиента нет. Единственная защита — не дать токену
 * просрочиться, то есть обновлять его ЗАРАНЕЕ, на подходе к порогу.
 *
 * Реализация повторяет `registerAutoRefresh` из SDK, но для коллекции `users`:
 * штатный авто-refresh SDK вешает только на `_superusers` и внутри
 * `authWithPassword`, к нашей кастомной аутентификации он отношения не имеет.
 *
 * Порядок шагов важнее каждого из них по отдельности:
 *  1. `query.autoRefresh` — рекурсия. Наш собственный `authRefresh` тоже идёт
 *     через `send`, а SDK переносит неизвестные поля в `query`
 *     (`normalizeUnknownQueryParams`), поэтому повторный запрос обязан уйти мимо
 *     хука, иначе бесконечная рекурсия.
 *  2. Обновляемся только при `authStore.isValid` И «осталось меньше порога».
 *  3. Меняем заголовок. `Client.initSendOptions` штампует `headers.Authorization`
 *     ДО вызова `beforeSend`, поэтому без подмены запрос ушёл бы с тем самым
 *     токеном, который мы только что заменили, и получил бы 401.
 */
const previousBeforeSend = pb.beforeSend;

pb.beforeSend = async (url, options) => {
  if (options.query?.autoRefresh) {
    return previousBeforeSend ? previousBeforeSend(url, options) : { url, options };
  }

  const staleToken = pb.authStore.token;

  if (pb.authStore.isValid && isTokenExpired(staleToken, AUTH_TOKEN_REFRESH_THRESHOLD_SECONDS)) {
    try {
      await pb.collection('users').authRefresh({ autoRefresh: true });
    } catch (error) {
      // Безопасно продолжать: запрос сейчас ещё не просрочен (`isValid` выше),
      // а разлогинивать пользователя здесь нельзя — это делает ветка 401 в
      // `afterSend` по факту ответа сервера, а не по факту неудачи продления.
      console.warn('Не удалось заранее продлить токен, запрос уходит со старым', error);
    }
  }

  const freshToken = pb.authStore.token;
  const headers = options.headers ?? {};
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'authorization' && value === staleToken && freshToken) {
      headers[name] = freshToken;
      break;
    }
  }
  options.headers = headers;

  return previousBeforeSend ? previousBeforeSend(url, options) : { url, options };
};

/**
 * Автоотмена запросов выключена намеренно.
 *
 * Ключ отмены в SDK — `(метод) + путь коллекции` БЕЗ query-параметров
 * (`Client.initSendOptions`: `requestKey || (method || "GET") + path`). Любой
 * следующий GET в ту же коллекцию отменяет предыдущий ещё не завершившийся:
 * фильтр, сортировка и постраничность в ключ не входят. Страница писем читает
 * `incoming_mails` трижды за один тик (письма дерева переписки, страница
 * реестра, полный список для поиска) — и реестр отменялся, уходил в ошибку,
 * а таблица показывала «Писем пока нет». Дедупликацию задаёт сам TanStack Query
 * по `queryKey`; собственный дедуп `requestKey` в `src/api/collections.ts`
 * (`upsertBalance`, `searchCounterparties`) при этом остаётся рабочим:
 * `upsertBalance` опирается на UNIQUE-индекс `(account_id, date)`, а
 * `useCounterpartySearch` и так не отменяет запросы с другим текстом.
 */
pb.autoCancellation(false);

/**
 * Разлогинивание живёт только здесь и только по факту ответа сервера.
 *
 * Раньше здесь была ветка `pb.authStore.refresh()` — метода, которого в SDK
 * нет: в `BaseAuthStore` есть только `token`, `record`, `model`, `isValid`,
 * `isSuperuser`, `isAdmin`, `isAuthRecord`, `save()`, `clear()`,
 * `loadFromCookie()`, `exportToCookie()`, `onChange()`. Приведение типа
 * `{ refresh?: () => Promise<void> }` молчало компилятору, а на рантайме
 * `authStore.refresh === undefined`, так что ветка не выполнялась никогда.
 */
pb.afterSend = (response, data) => {
  if (response.status === 401 && pb.authStore.token) {
    pb.authStore.clear();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }
  return data;
};
