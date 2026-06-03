import { describe, it, expect } from 'vitest';
import { formatAmountRub } from './format-currency';

describe('formatAmountRub', () => {
  it('formats whole number', () => {
    expect(formatAmountRub(50000)).toBe('50\u00a0000,00 ₽');
  });

  it('formats number with kopecks', () => {
    expect(formatAmountRub(12345.67)).toBe('12\u00a0345,67 ₽');
  });

  it('formats zero', () => {
    expect(formatAmountRub(0)).toBe('0,00 ₽');
  });

  it('formats small number', () => {
    expect(formatAmountRub(1.5)).toBe('1,50 ₽');
  });

  it('formats large number', () => {
    expect(formatAmountRub(1_234_567)).toBe('1\u00a0234\u00a0567,00 ₽');
  });

  it('formats negative number', () => {
    expect(formatAmountRub(-500)).toBe('-500,00 ₽');
  });

  it('rounds to two decimal places', () => {
    expect(formatAmountRub(10.999)).toBe('11,00 ₽');
  });
});
