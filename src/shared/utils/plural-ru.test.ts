import { describe, it, expect } from 'vitest';
import { pluralRu, pluralCount } from './plural-ru';

const INVOICE: [string, string, string] = ['счёт', 'счёта', 'счетов'];

describe('pluralRu', () => {
  it('singular for 1, 21, 101', () => {
    expect(pluralRu(1, INVOICE)).toBe('счёт');
    expect(pluralRu(21, INVOICE)).toBe('счёт');
    expect(pluralRu(101, INVOICE)).toBe('счёт');
  });

  it('paucal for 2-4 excluding 12-14', () => {
    expect(pluralRu(2, INVOICE)).toBe('счёта');
    expect(pluralRu(4, INVOICE)).toBe('счёта');
    expect(pluralRu(22, INVOICE)).toBe('счёта');
    expect(pluralRu(104, INVOICE)).toBe('счёта');
  });

  it('plural for 0, 5-20, 11-14', () => {
    expect(pluralRu(0, INVOICE)).toBe('счетов');
    expect(pluralRu(5, INVOICE)).toBe('счетов');
    expect(pluralRu(11, INVOICE)).toBe('счетов');
    expect(pluralRu(14, INVOICE)).toBe('счетов');
    expect(pluralRu(100, INVOICE)).toBe('счетов');
  });
});

describe('pluralCount', () => {
  it('joins number and word', () => {
    expect(pluralCount(1, INVOICE)).toBe('1 счёт');
    expect(pluralCount(3, INVOICE)).toBe('3 счёта');
    expect(pluralCount(12, INVOICE)).toBe('12 счетов');
  });
});
