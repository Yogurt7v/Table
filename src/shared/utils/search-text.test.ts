import { describe, it, expect } from 'vitest';
import { foldSearchText, matchesFolded } from './search-text';

describe('foldSearchText', () => {
  it('приводит к нижнему регистру', () => {
    expect(foldSearchText('Комус')).toBe('комус');
    expect(foldSearchText('ЖК Видный')).toBe('жк видный');
    expect(foldSearchText('ООО Ромашка')).toBe('ооо ромашка');
  });

  it('схлопывает NBSP и невидимые символы', () => {
    expect(foldSearchText('ООО\u00a0Ромашка')).toBe('ооо ромашка');
    expect(foldSearchText('а\u2003в')).toBe('а в');
    expect(foldSearchText('  много   пробелов ')).toBe('много пробелов');
  });

  it('пустая строка возвращает пустую строку', () => {
    expect(foldSearchText('')).toBe('');
  });
});

describe('matchesFolded', () => {
  it('кириллица регистронезависима', () => {
    expect(matchesFolded(['Комус'], foldSearchText('комус'))).toBe(true);
    expect(matchesFolded(['ЖК Видный'], foldSearchText('вид'))).toBe(true);
  });

  it('ищет по любому из полей', () => {
    expect(matchesFolded(['ООО Ромашка', 'Оплата по договору'], foldSearchText('оплат'))).toBe(true);
    expect(matchesFolded([null, undefined, 'ПТ-12'], foldSearchText('пт-12'))).toBe(true);
  });

  it('не находит отсутствующие значения', () => {
    expect(matchesFolded(['Комус'], foldSearchText('вит'))).toBe(false);
    expect(matchesFolded([null, ''], foldSearchText('вит'))).toBe(false);
  });

  it('пустой запрос всегда матчится', () => {
    expect(matchesFolded(['что-то'], '')).toBe(true);
    expect(matchesFolded([], '')).toBe(true);
  });
});