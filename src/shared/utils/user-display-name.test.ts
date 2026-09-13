import { describe, it, expect } from 'vitest';
import { getUserDisplayName } from './user-display-name';
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