import dayjs from 'dayjs';
import type { IInvoice } from '@/shared/types';

/** PocketBase отдаёт день как «2026-06-02» или как ISO-строку «2026-06-02 00:00:00.000Z». */
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

/** Приводит дату счёта к ключу дня YYYY-MM-DD без сдвига из-за часового пояса. */
function normalizeDay(value: string): string {
  // Берём календарную часть строки: `dayjs(...).format()` на ISO с UTC-полночью
  // в отрицательных часовых поясах мог бы вернуть предыдущий день.
  const prefixed = value.match(DATE_PREFIX);
  if (prefixed?.[1]) return prefixed[1];
  return dayjs(value).format('YYYY-MM-DD');
}

/**
 * Возвращает день реестра (YYYY-MM-DD), на который нужно перейти при открытии счёта:
 * день оплаты, если он доступен пользователю, иначе день самого счёта.
 */
export function resolveInvoiceNavigationDay(invoice: IInvoice, canViewPaidDate: boolean): string {
  // День оплаты выбираем только тем, кому разрешено видеть paid_date, — иначе
  // переход на дату счёта, чтобы не раскрывать дату оплаты косвенно.
  const day = canViewPaidDate && invoice.paid_date ? invoice.paid_date : invoice.date;
  return normalizeDay(day);
}
