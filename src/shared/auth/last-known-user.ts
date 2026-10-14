import type { IUser } from '@/shared/types';

/**
 * Реестр последнего известного пользователя.
 *
 * `pb.authStore.model` может стать null мгновенно — при просроченном токене
 * `afterSend` чистит store и редиректит на /login. Компоненты, которые
 * читают модель напрямую (автор счёта, настройки колонок), получали null
 * и рендрили «-» / пустые настройки.
 *
 * AuthContext пишёт сюда при каждом `onChange` с ненулевой моделью, так что
 * даже когда модель обнуляется, UI может отобразить последнего известного
 * пользователя до конца асинхронного редиректа. Это stateless реестр —
 * единственный источник истины для places, где нет доступа к React-контексту
 * (api-функции, хуки).
 */
let lastKnownUser: IUser | null = null;

export function setLastKnownUser(user: IUser | null): void {
  lastKnownUser = user;
}

export function getLastKnownUser(): IUser | null {
  return lastKnownUser;
}
