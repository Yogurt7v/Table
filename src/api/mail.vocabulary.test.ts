import { describe, expect, it } from 'vitest';
import { mergeCounterpartyVocabulary } from './mail';

/**
 * Проверяется чистая функция слияния, без мока SDK: словарь контрагентов —
 * единственная часть подсказок, где решает не запрос, а разбор строк, и именно
 * её ломает кириллица. Три источника — по одному на регистр, в том же порядке,
 * в каком их отдаёт `getOrgCounterpartyVocabulary`.
 */
describe('mergeCounterpartyVocabulary', () => {
  it('сливает три источника в один список', () => {
    const result = mergeCounterpartyVocabulary([
      ['ООО «Ленметрострой»'],
      ['ПАО «Север»'],
      ['ИП Кузнецов'],
    ]);
    expect(result).toEqual(['ИП Кузнецов', 'ООО «Ленметрострой»', 'ПАО «Север»']);
  });

  it('обрезает края и выбрасывает пустые значения', () => {
    const result = mergeCounterpartyVocabulary([
      ['  ООО «Ленметрострой»  '],
      [null, undefined, '', '   ', '\u00a0'],
    ]);
    expect(result).toEqual(['ООО «Ленметрострой»']);
  });

  it('склеивает написания, различающиеся регистром, оставляя первое', () => {
    const result = mergeCounterpartyVocabulary([
      ['ООО «Ленметрострой»'],
      ['ооо «ленметрострой»'],
      ['ООО «ЛЕНМЕТРОСТРОЙ»'],
    ]);
    expect(result).toEqual(['ООО «Ленметрострой»']);
  });

  /**
   * Ключ склейки — свёрнутая форма (`foldSearchText`), а не `toLowerCase()`:
   * неразрывный пробел приходит в названиях организаций вместе с «» и тонкими
   * пробелами, а `toLowerCase()` оставляет его отличным от обычного, из-за чего
   * одно и то же название попало бы в подсказку дважды.
   */
  it('склеивает названия, различающиеся только неразрывным пробелом', () => {
    const result = mergeCounterpartyVocabulary([['ООО\u00a0«А»'], ['ООО «А»']]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('ООО\u00a0«А»');
    // Sanity check: наивный `toLowerCase()` развёл бы эти два названия.
    expect('ООО\u00a0«А»'.toLowerCase()).not.toBe('ООО «А»'.toLowerCase());
  });

  /**
   * Порядок — русская локаль, а не порядок кодовых точек: по кодам «Ёлка» встала
   * бы в самое начало, а по-русски она стоит между «Гамма» и «Ель».
   */
  it('сортирует по-русски, а не по кодовым точкам', () => {
    const source = ['Яндекс', 'ООО «Альфа»', 'Бета', 'Ёлка', 'Ель', 'Гамма'];
    const result = mergeCounterpartyVocabulary([source]);
    expect(result).toEqual(['Бета', 'Гамма', 'Ёлка', 'Ель', 'ООО «Альфа»', 'Яндекс']);
    expect(result).not.toEqual([...source].sort());
  });

  it('на пустых источниках возвращает пустой список', () => {
    expect(mergeCounterpartyVocabulary([])).toEqual([]);
    expect(mergeCounterpartyVocabulary([[], [], []])).toEqual([]);
  });
});
