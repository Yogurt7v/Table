// Тесты для mail-register-target.ts
// clean, focused, покрывают ветвления

import { describe, it, expect } from 'vitest';
import type { MailType } from '@/shared/types';
import { computeRegisterTarget, registerTargetIncludesPeriodChange } from './mail-register-target';

describe('mail-register-target: computeRegisterTarget', () => {
  // Было бы удобно тестировать все комбинации, но достаточно ключевых.
  const currentIncoming: MailType = 'incoming';
  const currentOutgoing: MailType = 'outgoing';

  it('остается на той же вкладке, ставит период одинаковый', () => {
    const res = computeRegisterTarget('incoming', '2026-10-07', currentIncoming);
    expect(res.tab).toBe('incoming');
    expect(res.customFrom).toBe('2026-10-07');
    expect(res.customTo).toBe('2026-10-07');
  });

  it('переключает вкладку, ставит период одинаковый', () => {
    const res = computeRegisterTarget('outgoing', '2026-10-07', currentIncoming);
    expect(res.tab).toBe('outgoing');
    expect(res.customFrom).toBe('2026-10-07');
    expect(res.customTo).toBe('2026-10-07');
  });

  it('если письмо без даты — период не менять, вкладка зависит от типа', () => {
    const res1 = computeRegisterTarget('incoming', undefined, currentOutgoing);
    expect(res1.tab).toBe('incoming');
    expect(res1.customFrom).toBeUndefined();
    expect(res1.customTo).toBeUndefined();

    const res2 = computeRegisterTarget('outgoing', null, currentIncoming);
    expect(res2.tab).toBe('outgoing');
    expect(res2.customFrom).toBeUndefined();
    expect(res2.customTo).toBeUndefined();
  });

  it('если письмо с датой, но текущая вкладка совпадает — период ставится, вкладка сохраняется', () => {
    const res = computeRegisterTarget('incoming', '2026-01-01', currentIncoming);
    expect(res.tab).toBe('incoming');
    expect(res.customFrom).toBe('2026-01-01');
    expect(res.customTo).toBe('2026-01-01');
  });
});

describe('mail-register-target: registerTargetIncludesPeriodChange', () => {
  it('true, если оба поля присутствуют', () => {
    expect(
      registerTargetIncludesPeriodChange({
        tab: 'incoming',
        customFrom: '2026-10-07',
        customTo: '2026-10-07',
      }),
    ).toBe(true);
  });

  it('false, если хотя бы одно пустое', () => {
    expect(
      registerTargetIncludesPeriodChange({
        tab: 'incoming',
        customFrom: '',
        customTo: '2026-10-07',
      }),
    ).toBe(false);
    expect(
      registerTargetIncludesPeriodChange({
        tab: 'incoming',
        customFrom: '2026-10-07',
        customTo: '',
      }),
    ).toBe(false);
    expect(
      registerTargetIncludesPeriodChange({
        tab: 'incoming',
        customFrom: undefined,
        customTo: undefined,
      }),
    ).toBe(false);
  });
});