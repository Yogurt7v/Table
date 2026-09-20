import { describe, it, expect } from 'vitest';
import { getInitiatorDisplayName, getUserDisplayName } from './user-display-name';
import type { IUser } from '@/shared/types';

function makeUser(overrides: Partial<IUser> = {}): IUser {
  return {
    id: 'u1',
    email: 'a@local.host',
    login: 'alex',
    name: 'Алексей',
    avatar: '',
    verified: false,
    created: '',
    updated: '',
    ...overrides,
  };
}

describe('getUserDisplayName', () => {
  it('возвращает name когда он заполнен', () => {
    expect(getUserDisplayName(makeUser())).toBe('Алексей');
  });

  it('падает на login когда name пустой', () => {
    expect(getUserDisplayName(makeUser({ name: '' }))).toBe('alex');
  });

  it('возвращает «—» когда и name и login пустые', () => {
    expect(getUserDisplayName(makeUser({ name: '', login: '' }))).toBe('—');
  });

  it('возвращает «—» для undefined', () => {
    expect(getUserDisplayName(undefined)).toBe('—');
  });
});

describe('getInitiatorDisplayName', () => {
  it('предпочитает снимок имени, даже когда пользователь удалён', () => {
    const userMap = new Map<string, IUser>();
    expect(getInitiatorDisplayName('deleted-user-id', 'Анна Смирнова', userMap)).toBe('Анна Смирнова');
  });

  it('берёт имя из userMap, когда снимка нет', () => {
    const userMap = new Map<string, IUser>([['u1', makeUser()]]);
    expect(getInitiatorDisplayName('u1', '', userMap)).toBe('Алексей');
  });

  it('возвращает «—», когда ни снимка, ни пользователя нет', () => {
    // счёт создан суперюзером: его id отсутствует в users
    expect(getInitiatorDisplayName('superuser-id', undefined, new Map())).toBe('—');
    expect(getInitiatorDisplayName('', '', new Map())).toBe('—');
  });

  it('не подменяет снимок именем пользователя с тем же id', () => {
    const userMap = new Map<string, IUser>([['u1', makeUser({ name: 'Новое Имя' })]]);
    expect(getInitiatorDisplayName('u1', 'Старое Имя', userMap)).toBe('Старое Имя');
  });
});