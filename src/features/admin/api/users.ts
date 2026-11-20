/** Пользователи: чтение, создание, обновление и удаление. */

import { pb } from '@/api/client';
import type { IUser } from '@/shared/types';

/** Возвращает всех пользователей. */
export function getUsers() {
  return pb.collection('users').getFullList<IUser>({
    sort: 'created',
  });
}

/** Создаёт пользователя (логин, пароль, имя) с локальным email. */
export function createUser(login: string, password: string, name: string) {
  return pb.collection('users').create<IUser>({
    login,
    email: `${login}@local.host`,
    password,
    passwordConfirm: password,
    name,
    emailVisibility: false,
  });
}

/** Удаляет пользователя. */
export function deleteUser(id: string) {
  return pb.collection('users').delete(id);
}

/** Данные для частичного обновления пользователя. */
export interface UpdateUserData {
  name?: string;
  login?: string;
  password?: string;
}

/** Обновляет данные пользователя (имя, логин/email, пароль). */
export function updateUser(id: string, data: UpdateUserData) {
  const payload: Record<string, string> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.login !== undefined) {
    payload.login = data.login;
    payload.email = `${data.login}@local.host`;
  }
  if (data.password) {
    payload.password = data.password;
    payload.passwordConfirm = data.password;
  }
  return pb.collection('users').update<IUser>(id, payload);
}
