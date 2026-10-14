import { describe, it, expect } from 'vitest';
import {
  DELETION_REASON_PREFIX,
  appendDeletionReason,
  stripDeletionReason,
} from './deletion-reason';

const PREFIX = 'причина удаления: ';

describe('DELETION_REASON_PREFIX', () => {
  it('совпадает с литералом, которым помечается строка причины', () => {
    expect(DELETION_REASON_PREFIX).toBe(PREFIX);
  });
});

describe('appendDeletionReason', () => {
  it('пустой комментарий превращается в одну строку причины, без ведущего перевода строки', () => {
    expect(appendDeletionReason('', 'причина')).toBe('причина удаления: причина');
  });

  it('null/undefined комментарий равнозначны пустому', () => {
    expect(appendDeletionReason(null, 'дубль')).toBe('причина удаления: дубль');
    expect(appendDeletionReason(undefined, 'дубль')).toBe('причина удаления: дубль');
  });

  it('непустой комментарий сохраняется, причина уходит новой строкой под ним', () => {
    expect(appendDeletionReason('первая строка', 'дубль')).toBe(
      'первая строка\nпричина удаления: дубль',
    );
  });

  it('многострочный комментарий не переписывается, добавляется только хвост', () => {
    expect(appendDeletionReason('раз\nдва', 'ошибка ввода')).toBe(
      'раз\nдва\nпричина удаления: ошибка ввода',
    );
  });

  it('пустая причина оставляет комментарий без изменений', () => {
    expect(appendDeletionReason('первая строка', '')).toBe('первая строка');
  });

  it('причина из одних пробелов считается пустой и ничего не добавляет', () => {
    expect(appendDeletionReason('первая строка', '   \n\t  ')).toBe('первая строка');
  });

  it('пустая причина при пустом комментарии даёт пустую строку, а не висячий префикс', () => {
    expect(appendDeletionReason('', '  ')).toBe('');
    expect(appendDeletionReason(null, '')).toBe('');
  });

  it('причина обрезается от окружающих пробелов', () => {
    expect(appendDeletionReason('первая строка', '   дубль \n')).toBe(
      'первая строка\nпричина удаления: дубль',
    );
  });

  it('висячие пробелы в конце комментария срезаются, пустой строки перед причиной не остаётся', () => {
    expect(appendDeletionReason('первая строка   \n  \t ', 'дубль')).toBe(
      'первая строка\nпричина удаления: дубль',
    );
  });

  it('вторая причина дописывается третьей строкой, а не сливается с первой', () => {
    const once = appendDeletionReason('комментарий', 'дубль');
    expect(appendDeletionReason(once, 'оплата не прошла')).toBe(
      'комментарий\nпричина удаления: дубль\nпричина удаления: оплата не прошла',
    );
  });
});

describe('stripDeletionReason', () => {
  it('убирает хвостовую строку причины и возвращает исходный комментарий', () => {
    expect(stripDeletionReason('первая строка\nпричина удаления: дубль')).toBe('первая строка');
  });

  it('комментарий без причины не меняется', () => {
    expect(stripDeletionReason('первая строка\nвторая строка')).toBe(
      'первая строка\nвторая строка',
    );
  });

  it('комментарий из одной строки причины схлопывается в пустую строку', () => {
    expect(stripDeletionReason('причина удаления: дубль')).toBe('');
  });

  it('пустой, null и undefined комментарий остаются пустыми', () => {
    expect(stripDeletionReason('')).toBe('');
    expect(stripDeletionReason(null)).toBe('');
    expect(stripDeletionReason(undefined)).toBe('');
  });

  it('строка причины в середине комментария остаётся на месте', () => {
    expect(stripDeletionReason('причина удаления: старое\nживая заметка')).toBe(
      'причина удаления: старое\nживая заметка',
    );
  });

  it('при нескольких строках причины срезается только последняя', () => {
    expect(stripDeletionReason('раз\nпричина удаления: раз\nпричина удаления: два')).toBe(
      'раз\nпричина удаления: раз',
    );
  });

  it('хвостовые пустые строки не мешают снять причину', () => {
    expect(stripDeletionReason('первая строка\nпричина удаления: дубль\n\n  \n')).toBe(
      'первая строка',
    );
  });

  it('причина с отступом распознаётся: ведущие пробелы строки не мешают', () => {
    expect(stripDeletionReason('первая строка\n   причина удаления: дубль')).toBe('первая строка');
  });

  it('строка, лишь начинающаяся с похожих слов, причиной не считается', () => {
    expect(stripDeletionReason('первая строка\nпричина удаления без двоеточия')).toBe(
      'первая строка\nпричина удаления без двоеточия',
    );
  });

  it('текст без перевода строки и с причиной посередине не портится', () => {
    expect(stripDeletionReason('причина удаления: внутри строки')).toBe('');
  });
});

describe('appendDeletionReason / stripDeletionReason', () => {
  it('пара функций возвращает комментарий к исходному виду', () => {
    const original = 'первая строка\nвторая строка';
    expect(stripDeletionReason(appendDeletionReason(original, 'дубль'))).toBe(original);
  });

  it('пустой исходный комментарий после цикла остаётся пустым', () => {
    expect(stripDeletionReason(appendDeletionReason('', 'дубль'))).toBe('');
  });
});
