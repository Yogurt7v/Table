import { describe, it, expect } from 'vitest';
import { rankCounterpartyMatches } from './mail-counterparty-match';

/**
 * Ранжирование контрагентов проверяется на словаре, который продюсер уже
 * отсортировал `localeCompare(a, b, 'ru')`, — поэтому все фикстуры записаны
 * именно в таком порядке, и порядок входа сам по себе является тайбрейком.
 */

/** Реальные значения из базы, в алфавитном порядке `ru`. */
const VOCABULARY = ['ИП Соколов А. В.', 'ООО «Ленметрострой-ТД»', 'ПАО «Метроинвест»'] as const;

/** Фикстура с единственным совпадением с начала строки, для проверки `limit`. */
const PREFIX_OPTIONS = ['АО «Ленсокол»', 'ИП Соколов А. В.', 'Сокол-Авто'] as const;

/**
 * Фикстура, где алфавитный порядок противоположен ранжированию: слабое
 * совпадение из середины слова стоит первым, граничное — последним.
 */
const RANKING_OPTIONS = ['АО «Гипотеза»', 'ИП Иванов А. В.', 'ООО «Ленметрострой-ТД» ИП'] as const;

describe('rankCounterpartyMatches: регистр и подстрока', () => {
  it('находит контрагента по фрагменту в любом регистре', () => {
    expect(rankCounterpartyMatches(VOCABULARY, 'сокол', 10)).toEqual(['ИП Соколов А. В.']);
    expect(rankCounterpartyMatches(VOCABULARY, 'Сокол', 10)).toEqual(['ИП Соколов А. В.']);
    expect(rankCounterpartyMatches(VOCABULARY, 'СОКОЛОВ', 10)).toEqual(['ИП Соколов А. В.']);
    expect(rankCounterpartyMatches(VOCABULARY, 'ип соколов', 10)).toEqual(['ИП Соколов А. В.']);
  });

  it('находит фрагмент из середины слова', () => {
    expect(rankCounterpartyMatches(['ООО «Ленметрострой-ТД»'], 'метро', 10)).toEqual([
      'ООО «Ленметрострой-ТД»',
    ]);
  });

  it('ранжирует два среднесловных совпадения по позиции совпадения', () => {
    // «метроинвест» начинается раньше «ленметрострой», поэтому идёт первым.
    expect(rankCounterpartyMatches(VOCABULARY, 'метро', 10)).toEqual([
      'ПАО «Метроинвест»',
      'ООО «Ленметрострой-ТД»',
    ]);
  });

  it('не возвращает значение, в котором запрос не встречается', () => {
    expect(rankCounterpartyMatches(VOCABULARY, 'сокол', 10)).not.toContain('ПАО «Метроинвест»');
    expect(rankCounterpartyMatches(VOCABULARY, 'волшебник', 10)).toEqual([]);
  });
});

describe('rankCounterpartyMatches: ранжирование', () => {
  it('ранжирует по ярусам, а не по алфавиту', () => {
    expect(rankCounterpartyMatches(RANKING_OPTIONS, 'ип', 10)).toEqual([
      'ИП Иванов А. В.',
      'ООО «Ленметрострой-ТД» ИП',
      'АО «Гипотеза»',
    ]);
  });

  it('ставит совпадение с начала строки перед совпадением из середины слова', () => {
    expect(rankCounterpartyMatches(PREFIX_OPTIONS, 'сокол', 10)).toEqual([
      'Сокол-Авто',
      'ИП Соколов А. В.',
      'АО «Ленсокол»',
    ]);
  });

  it('ставит совпадение на границе слова перед совпадением внутри слова', () => {
    expect(
      rankCounterpartyMatches(['Банк «Гипотеза»', 'ООО «Ленметрострой-ТД» ИП'], 'ип', 10),
    ).toEqual(['ООО «Ленметрострой-ТД» ИП', 'Банк «Гипотеза»']);
  });

  it('внутри яруса ставит раньше то, где совпадение начинается раньше', () => {
    expect(
      rankCounterpartyMatches(['АО «Вектор» ООО «Альфа»', 'ИП Соколов ООО «Вектор»'], 'ооо', 10),
    ).toEqual(['ИП Соколов ООО «Вектор»', 'АО «Вектор» ООО «Альфа»']);
  });

  it('при равной позиции сохраняет порядок входа', () => {
    expect(
      rankCounterpartyMatches(['ООО «Альфа» ООО «Бета»', 'ООО «Веста» ООО «Гамма»'], 'ооо', 10),
    ).toEqual(['ООО «Альфа» ООО «Бета»', 'ООО «Веста» ООО «Гамма»']);
  });
});

describe('rankCounterpartyMatches: limit', () => {
  it('обрезает список до limit и оставляет лучшие', () => {
    expect(rankCounterpartyMatches(RANKING_OPTIONS, 'ип', 2)).toEqual([
      'ИП Иванов А. В.',
      'ООО «Ленметрострой-ТД» ИП',
    ]);
    expect(rankCounterpartyMatches(PREFIX_OPTIONS, 'сокол', 1)).toEqual(['Сокол-Авто']);
  });

  it('пустой или отрицательный limit даёт пустой список', () => {
    expect(rankCounterpartyMatches(VOCABULARY, 'ип', 0)).toEqual([]);
    expect(rankCounterpartyMatches(VOCABULARY, 'ип', -3)).toEqual([]);
  });
});

describe('rankCounterpartyMatches: пустой запрос', () => {
  it('на пустой и пробельный запрос отдаёт входной порядок, обрезанный по limit', () => {
    expect(rankCounterpartyMatches(PREFIX_OPTIONS, '', 10)).toEqual([...PREFIX_OPTIONS]);
    expect(rankCounterpartyMatches(PREFIX_OPTIONS, '   ', 10)).toEqual([...PREFIX_OPTIONS]);
    expect(rankCounterpartyMatches(PREFIX_OPTIONS, '', 2)).toEqual([
      'АО «Ленсокол»',
      'ИП Соколов А. В.',
    ]);
  });

  it('выбрасывает значения, которые сворачиваются в пустую строку', () => {
    expect(rankCounterpartyMatches(['', '   ', 'ООО «Альфа»'], '', 10)).toEqual(['ООО «Альфа»']);
  });
});

describe('rankCounterpartyMatches: невидимые пробелы', () => {
  it('находит значение с NBSP по запросу с обычным пробелом', () => {
    expect(rankCounterpartyMatches(['ООО\u00a0«Альфа»'], 'ООО «Альфа»', 10)).toEqual([
      'ООО\u00a0«Альфа»',
    ]);
  });

  it('находит значение с NBSP по запросу в другом регистре', () => {
    expect(rankCounterpartyMatches(['ООО\u00a0«Альфа»'], 'ооо «альфа»', 10)).toEqual([
      'ООО\u00a0«Альфа»',
    ]);
  });
});

describe('rankCounterpartyMatches: целостность входа и выхода', () => {
  it('не мутирует входной массив', () => {
    const input = [...RANKING_OPTIONS];
    const snapshot = [...input];

    rankCounterpartyMatches(input, 'ип', 10);

    expect(input).toEqual(snapshot);
  });

  it('не возвращает дубликаты, даже если они различаются только невидимыми пробелами', () => {
    expect(rankCounterpartyMatches(['ООО «Альфа»', 'ООО\u00a0«Альфа»'], 'ооо', 10)).toEqual([
      'ООО «Альфа»',
    ]);
  });
});
