import type { CSSProperties } from 'react';

/** Узкая колонка всё ещё должна читаться: меньше — уже не буква, а полоса. */
export const MIN_COLUMN_WIDTH_PX = 50;

/** Разделитель ширины колонки на правой границе заголовка. */
export const RESIZE_HANDLE_STYLE: CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 10,
  cursor: 'col-resize',
  userSelect: 'none',
  borderRight: '1px solid var(--mantine-color-gray-3)',
};

/** Липкая шапка таблицы писем под шапкой приложения. */
export const TH_STYLE: CSSProperties = {
  position: 'sticky',
  top: 56,
  zIndex: 1,
  backgroundColor: 'var(--mantine-color-body)',
  overflow: 'hidden',
};

/**
 * `table-layout: fixed` не ужимает содержимое ячейки: колонку, сжатую
 * перетаскиванием соседней, «30.09.2026» выступил бы прямо на «01/2026».
 * Заголовок обрезается по `overflow: hidden` — ячейка обязана вести себя так же,
 * иначе переполнение появляется именно там, где пользователь ширину настроил.
 */
export const TD_STYLE: CSSProperties = { overflow: 'hidden' };
