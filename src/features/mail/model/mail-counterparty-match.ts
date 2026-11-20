import { foldSearchText } from '@/shared/utils/search-text';

/**
 * Ранжирование контрагентов для выпадающего списка `Autocomplete` формы письма.
 *
 * Зачем это отдельная функция, а не `defaultOptionsFilter` Mantine: тот
 * сохраняет порядок `options` и обрезает его по `limit`, а словарь контрагентов
 * (`mergeCounterpartyVocabulary` в `src/api/mail.ts`) отсортирован по алфавиту
 * целиком. Совпадение из середины слова, сортирующееся поздно, просто не
 * попадало в выпадающий список — человек не видел нужного значения. Плюс там
 * только `trim()`, а в этих данных встречаются NBSP и тонкие пробелы, поэтому
 * сравнение идёт через `foldSearchText` с обеих сторон.
 *
 * Ожидается, что `options` уже отсортирован `localeCompare(a, b, 'ru')` — тем
 * способом, которым его отдаёт продюсер. Этот порядок сохраняется как
 * последний тайбрейк и **внутри** яруса не пересортировывается: сортировка
 * здесь не изобретает порядок, которого продюсер не знает, а лишь переставляет
 * элементы детерминированно. Ярусы: начало строки → граница слова → любое
 * место; внутри яруса раньше та позиция совпадения, раньше та исходная позиция.
 *
 * Результат обрезан по `limit` — вызывающая сторона отдаёт его в `OptionsDropdown`
 * как есть.
 */

/** Совпадение начинает строку — сильнее всего. */
const TIER_PREFIX = 0;
/** Совпадение начинается после пробела — начало слова. */
const TIER_WORD_BOUNDARY = 1;
/** Совпадение внутри слова. */
const TIER_ANYWHERE = 2;

interface RankedCounterparty {
  /** Исходное значение — в выпадающий список уходит именно оно, а не фолд. */
  value: string;
  /** Ярус: меньше — лучше. */
  tier: number;
  /** Позиция первого совпадения в фолднутом значении. */
  position: number;
  /** Индекс во входном массиве — последний тайбрейк. */
  inputIndex: number;
}

/** Один лучший ярус на значение: позиция 0 — это начало строки, а не граница слова. */
function tierOf(foldedValue: string, position: number): number {
  if (position === 0) return TIER_PREFIX;
  return foldedValue[position - 1] === ' ' ? TIER_WORD_BOUNDARY : TIER_ANYWHERE;
}

/**
 * `options` — словарь контрагентов, уже отсортированный алфавитом (`ru`);
 * `query` — то, что человек набрал. Возвращает совпавшие значения, лучшие
 * первыми, не длиннее `limit`. Пустой запрос даёт входной порядок.
 */
export function rankCounterpartyMatches(
  options: readonly string[],
  query: string,
  limit: number,
): string[] {
  if (limit <= 0) return [];

  const foldedQuery = foldSearchText(query);
  const seen = new Set<string>();
  const ranked: RankedCounterparty[] = [];

  options.forEach((value, inputIndex) => {
    const foldedValue = foldSearchText(value);
    // Пустое и «из одних пробелов» значение — не контрагент, а мусор в данных.
    if (!foldedValue || seen.has(foldedValue)) return;
    seen.add(foldedValue);

    // Пустой запрос находится в позиции 0 у любого значения — совпадает всё.
    const position = foldedValue.indexOf(foldedQuery);
    if (position < 0) return;

    ranked.push({ value, tier: tierOf(foldedValue, position), position, inputIndex });
  });

  ranked.sort((a, b) => a.tier - b.tier || a.position - b.position || a.inputIndex - b.inputIndex);
  return ranked.slice(0, limit).map((entry) => entry.value);
}
