import { describe, it, expect } from 'vitest';
import { pb } from './index';
import { pb as pbDirect } from './client';

describe('api/index', () => {
  it('реэкспортирует pb из client', () => {
    expect(pb).toBe(pbDirect);
  });

  it('pb — экземпляр PocketBase', () => {
    expect(pb).toBeDefined();
    expect(typeof pb.collection).toBe('function');
  });
});
