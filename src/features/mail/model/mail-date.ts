import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

/**
 * Даты писем живут в PocketBase как строки полуночи UTC
 * (`2026-01-15 00:00:00.000Z`), и `buildMailFilter` в `src/api/mail.ts`
 * сравнивает их лексикографически: `date >= "2026-01-15"` и
 * `date <= "2026-01-15 23:59:59"`. Отсюда два правила, которые нельзя
 * нарушать:
 *
 *  1. **Границы фильтра** обязаны быть календарными днями В ЛОКАЛЬНОЙ таймзоне
 *     пользователя, отформатированными в `YYYY-MM-DD`. `toISOString()` здесь
 *     сдвинул бы день назад для восточных зон.
 *  2. **Отображение** обязано читать первые 10 символов строки, а не
 *     `new Date(строка)`: в UTC−5 локальное время полуночи UTC — это
 *     предыдущие сутки, и каждое письмо уехало бы на день назад.
 *
 * Обе операции сведены к одному примитиву — календарной дате `YYYY-MM-DD`.
 */

const DATE_KEY_LENGTH = 10;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `2026-01-15 00:00:00.000Z` → `2026-01-15`. Любой мусор → `''`. */
export function toDateKey(value?: string | null): string {
  if (!value) return '';
  const key = value.slice(0, DATE_KEY_LENGTH);
  return DATE_KEY_PATTERN.test(key) ? key : '';
}

/** Локальная полуночь для `DatePickerInput`: календарный день без сдвига зоны. */
export function dateKeyToLocalDate(key?: string | null): Date | null {
  if (!key) return null;
  const parsed = dayjs(key);
  return parsed.isValid() ? parsed.toDate() : null;
}

/** `Date` из пикера → `YYYY-MM-DD` для фильтра и для записи в PocketBase. */
export function localDateToDateKey(date?: Date | null): string {
  if (!date) return '';
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

/**
 * Локальная полночь `YYYY-MM-DD` → `Date`. Единственный способ получить
 * «сегодня» без подстановки часов, из-за которых `subtract` может перескочить
 * сутки.
 */
export function todayDateKey(): string {
  return dayjs().format('YYYY-MM-DD');
}

/** Граница фильтра `dateFrom`/`dateTo`. Пустая строка = граница не задана. */
export function dateKeyToBound(key?: string | null): string | undefined {
  return toDateKey(key) || undefined;
}

export type MailPeriodPreset = 'today' | 'week' | 'month' | 'all' | 'custom';

export interface MailPeriodBounds {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Раскрывает предустановку периода в границы. Считает от локальной полночи
 * (`dayjs().startOf('day')`), поэтому «7 дней» — это сегодня и шесть
 * предыдущих календарных дней независимо от времени суток.
 */
export function resolvePeriodBounds(
  preset: MailPeriodPreset,
  customFrom?: string,
  customTo?: string,
  base?: Dayjs,
): MailPeriodBounds {
  const today = (base ?? dayjs()).startOf('day');

  switch (preset) {
    case 'today':
      return { dateFrom: today.format('YYYY-MM-DD'), dateTo: today.format('YYYY-MM-DD') };
    case 'week':
      return {
        dateFrom: today.subtract(6, 'day').format('YYYY-MM-DD'),
        dateTo: today.format('YYYY-MM-DD'),
      };
    case 'month':
      return {
        dateFrom: today.startOf('month').format('YYYY-MM-DD'),
        dateTo: today.format('YYYY-MM-DD'),
      };
    case 'custom': {
      const from = toDateKey(customFrom);
      const to = toDateKey(customTo);
      return {
        ...(from ? { dateFrom: from } : {}),
        ...(to ? { dateTo: to } : {}),
      };
    }
    case 'all':
    default:
      return {};
  }
}

/** Отображение календарной даты письма: `15.01.2026`. */
export function formatMailDate(value?: string | null): string {
  const key = toDateKey(value);
  if (!key) return '';
  return dayjs(key).format('DD.MM.YYYY');
}

/** Полная дата с временем — для `created`, `updated`, `deleted_at`, `changed_at`. */
export function formatMailTimestamp(value?: string | null): string {
  if (!value) return '';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD.MM.YYYY HH:mm') : '';
}

/** Дата со временем секундами — для истории изменений. */
export function formatMailTimestampSeconds(value?: string | null): string {
  if (!value) return '';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD.MM.YYYY HH:mm:ss') : '';
}

/** «Сегодня» / «вчера» / дата — для подписи найденного. */
export function formatMailRelativeDate(value?: string | null): string {
  const key = toDateKey(value);
  if (!key) return '';
  const parsed = dayjs(key);
  if (!parsed.isValid()) return '';
  if (parsed.isSame(dayjs(), 'day')) return 'сегодня';
  if (parsed.isSame(dayjs().subtract(1, 'day'), 'day')) return 'вчера';
  return parsed.format('DD.MM.YYYY');
}

/**
 * Подпись периода для строки активных фильтров: предустановка остаётся
 * собственной надписью, произвольный диапазон печатается границами.
 */
export function formatPeriodBounds(
  preset: MailPeriodPreset,
  customFrom?: string,
  customTo?: string,
): string {
  const { dateFrom, dateTo } = resolvePeriodBounds(preset, customFrom, customTo);
  if (!dateFrom && !dateTo) return '';
  if (dateFrom && dateTo && dateFrom === dateTo) return formatMailDate(dateFrom);
  return `${dateFrom ? formatMailDate(dateFrom) : '…'} — ${dateTo ? formatMailDate(dateTo) : '…'}`;
}
