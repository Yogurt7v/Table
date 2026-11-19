/** Пользовательские настройки (ключ-значение) с upsert-семантикой. */

import { pb } from '../client.ts';
import type { IUserSetting } from '@/shared/types';

/** Возвращает настройку пользователя по ключу. */
export function getUserSetting(userId: string, key: string) {
  return pb
    .collection('user_settings')
    .getFirstListItem<IUserSetting>(`user_id = "${userId}" && key = "${key}"`);
}

/** Создаёт или обновляет настройку пользователя по ключу. */
export function upsertUserSetting(userId: string, key: string, value: unknown) {
  return pb
    .collection('user_settings')
    .getFirstListItem<IUserSetting>(`user_id = "${userId}" && key = "${key}"`)
    .then((existing) => pb.collection('user_settings').update<IUserSetting>(existing.id, { value }))
    .catch((err) => {
      if (err?.status === 404) {
        return pb.collection('user_settings').create<IUserSetting>({
          user_id: userId,
          key,
          value,
        });
      }
      throw err;
    });
}
