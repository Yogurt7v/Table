import PocketBase from 'pocketbase';

const API_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:8090'
  : window.location.origin;

export const pb = new PocketBase(API_URL);

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

pb.afterSend = (response, data) => {
  if (response.status === 401 && pb.authStore.token) {
    pb.authStore.clear();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }
  return data;
};
