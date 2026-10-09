// Pure helper for register target computation (no React, no I/O, no Mantine)
// Used by MailSection jump handler

import type { MailType } from '@/shared/types';
import { resolvePeriodBounds } from './mail-date';

export type MailRegisterTarget = {
  tab: MailType;
  customFrom?: string;
  customTo?: string;
};

/**
 * Рассчитать целевую вкладку и период для перехода к письму из дерева переписки.
 * @param targetType — регистр письма (incoming/outgoing)
 * @param targetDate — дата письма в формате YYYY‑MM‑DD (или undefined)
 * @param currentTab — текущая активная вкладка реестра
 * @returns target для хука useMailFilters.setCustomRange
 *
 * Правила:
 * 1. Если тип письма совпадает с currentTab → оставить вкладку, переключить период.
 * 2. Если тип письма отличается → переключить вкладку на letterType, сохранить период (пустой, чтобы не менять текущий).
 * 3. Если letterDate пусто → период не менять (возвращает пустые from/to).
 */
export function computeRegisterTarget(
  targetType: MailType,
  targetDate?: string | null,
  currentTab: MailType,
): MailRegisterTarget {
  const shouldSwitchTab = targetType !== currentTab;
  const tab = shouldSwitchTab ? targetType : currentTab;

  if (!targetDate) {
    // Письмо без даты — период не менять.
    return { tab };
  }

  // Направить период на день письма (single‑day диапазон).
  const bounds = resolvePeriodBounds('custom', targetDate, targetDate);
  return { tab, customFrom: bounds.dateFrom, customTo: bounds.dateTo };
}

/**
 * Утилита для использования в тестах: сопоставляет target с тем, чему ожидаем вызвать setCustomRange.
 * Возвращает null, если target не включает custom диапазон (то есть вкладка не меняется).
 */
export function registerTargetIncludesPeriodChange(target: MailRegisterTarget): boolean {
  return Boolean(target.customFrom && target.customTo);
}
