/** Приводит текст к форме для регистронезависимого поиска:
 *  нижний регистр + схлопывание невидимых символов (NBSP и др.) в один пробел.
 *  WITHOUT normalize — достаточно для поиска; normalize ломается в Goja не используется здесь. */
export function foldSearchText(text: string): string {
  return text
    .replace(/[\u00a0\u2000-\u200f\u2028-\u202f\u205f\u3000\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Проверяет, что хотя бы одно из значений содержит фолднутый запрос. */
export function matchesFolded(values: readonly (string | null | undefined)[], foldedQuery: string): boolean {
  if (!foldedQuery) return true;
  for (const v of values) {
    if (v && v.toLowerCase().includes(foldedQuery)) return true;
  }
  return false;
}