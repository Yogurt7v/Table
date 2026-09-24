export type TestRole = 'admin' | 'moderator' | 'user' | 'boss' | 'guest';

export interface E2EUser {
  login: string;
  password: string;
}

export type E2EUserMap = Record<TestRole, E2EUser>;
