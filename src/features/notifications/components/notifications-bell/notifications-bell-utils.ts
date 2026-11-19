import dayjs from 'dayjs';

// `describeFailure` в useNotifications.ts возвращает эту же строку как fallback,
// поэтому деталь ниже печатается только если error отличается от шапки.
export const LOAD_ERROR_TITLE = 'Не удалось загрузить уведомления';

/** Короткая дата для строки уведомления: день, месяц, часы и минуты. */
export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Полная дата для подписи выбранного дня в календаре. */
export function formatFullDate(dateStr: string) {
  return dayjs(dateStr).format('D MMMM YYYY, dddd');
}
