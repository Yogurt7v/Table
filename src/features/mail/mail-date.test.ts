import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  dateKeyToBound,
  dateKeyToLocalDate,
  formatMailDate,
  formatMailTimestamp,
  formatPeriodBounds,
  localDateToDateKey,
  resolvePeriodBounds,
  toDateKey,
} from './mail-date';

/**
 * Даты писем хранятся как полночь UTC (`YYYY-MM-DD 00:00:00.000Z`), а
 * `buildMailFilter` сравнивает их строками. Эти тесты фиксируют именно тот
 * инвариант: календарный день письма не должен «уезжать» ни на границе
 * фильтра, ни при отрисовке — иначе реестр показывает соседние даты.
 */

describe('toDateKey', () => {
  it('берёт календарную часть строки хранения', () => {
    expect(toDateKey('2026-01-15 00:00:00.000Z')).toBe('2026-01-15');
    expect(toDateKey('2026-01-15')).toBe('2026-01-15');
  });

  it('отбрасывает мусор и пустые значения', () => {
    expect(toDateKey('')).toBe('');
    expect(toDateKey(null)).toBe('');
    expect(toDateKey(undefined)).toBe('');
    expect(toDateKey('15.01.2026')).toBe('');
    expect(toDateKey('2026-1-5 00:00:00.000Z')).toBe('');
  });
});

describe('formatMailDate', () => {
  it('печатает календарный день без сдвига по зоне', () => {
    expect(formatMailDate('2026-01-15 00:00:00.000Z')).toBe('15.01.2026');
    expect(formatMailDate('2026-12-31 00:00:00.000Z')).toBe('31.12.2026');
  });

  it('пустое значение даёт пустую строку, а не Invalid Date', () => {
    expect(formatMailDate('')).toBe('');
    expect(formatMailDate(null)).toBe('');
  });
});

describe('dateKeyToLocalDate / localDateToDateKey', () => {
  it('пикер получает локальную полночь нужного дня', () => {
    const parsed = dateKeyToLocalDate('2026-01-15');
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(15);
    expect(parsed?.getHours()).toBe(0);
  });

  it('обратное преобразование не сдвигает день', () => {
    expect(localDateToDateKey(dateKeyToLocalDate('2026-01-15'))).toBe('2026-01-15');
  });

  it('пустое значение даёт null и пустую строку', () => {
    expect(dateKeyToLocalDate('')).toBeNull();
    expect(dateKeyToLocalDate(null)).toBeNull();
    expect(localDateToDateKey(null)).toBe('');
  });
});

describe('resolvePeriodBounds', () => {
  it('«всё время» не задаёт границ', () => {
    expect(resolvePeriodBounds('all')).toEqual({});
  });

  it('«сегодня» — один календарный день', () => {
    // Локальный день, а не `toISOString()`: западнее UTC календарный день пользователя
    // на единицу меньше UTC-даты, и сравнение с ней ловило бы тот самый сдвиг.
    const today = dayjs().format('YYYY-MM-DD');
    const bounds = resolvePeriodBounds('today');
    expect(bounds.dateFrom).toBeDefined();
    expect(bounds.dateFrom).toBe(bounds.dateTo);
    expect(bounds.dateFrom).toBe(today);
  });

  it('«7 дней» включает сегодняшний день и шесть предыдущих', () => {
    const bounds = resolvePeriodBounds('week');
    expect(bounds.dateTo).toBeDefined();
    expect(bounds.dateFrom).toBeDefined();
    const diff =
      (Date.parse(`${bounds.dateTo}T00:00:00Z`) - Date.parse(`${bounds.dateFrom}T00:00:00Z`)) /
      86_400_000;
    expect(diff).toBe(6);
  });

  it('«месяц» начинается с первого числа текущего месяца', () => {
    const bounds = resolvePeriodBounds('month');
    expect(bounds.dateFrom?.slice(8, 10)).toBe('01');
  });

  it('произвольный диапазон берёт только заданные границы', () => {
    expect(resolvePeriodBounds('custom', '2026-01-01', '')).toEqual({ dateFrom: '2026-01-01' });
    expect(resolvePeriodBounds('custom', '', '2026-01-31')).toEqual({ dateTo: '2026-01-31' });
    expect(resolvePeriodBounds('custom', '', '')).toEqual({});
  });
});

describe('formatPeriodBounds', () => {
  it('одиночный день печатается один раз', () => {
    expect(formatPeriodBounds('custom', '2026-01-15', '2026-01-15')).toBe('15.01.2026');
  });

  it('диапазон печатается границами', () => {
    expect(formatPeriodBounds('custom', '2026-01-01', '2026-01-31')).toBe(
      '01.01.2026 — 31.01.2026',
    );
  });

  it('пустой диапазон не даёт подпись', () => {
    expect(formatPeriodBounds('all', '', '')).toBe('');
  });
});

describe('границы фильтра', () => {
  it('пустая граница не попадает в параметры запроса', () => {
    expect(dateKeyToBound('')).toBeUndefined();
    expect(dateKeyToBound('2026-01-15 00:00:00.000Z')).toBe('2026-01-15');
  });
});

describe('formatMailTimestamp', () => {
  it('печатает дату и время создания', () => {
    expect(formatMailTimestamp('2026-01-15T10:30:00.000Z')).toMatch(
      /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/,
    );
  });

  it('пустое значение даёт пустую строку', () => {
    expect(formatMailTimestamp(undefined)).toBe('');
  });
});
