import { useCallback, useEffect, useRef, useState } from 'react';

/** Управляет подсветкой и автопрокруткой к документу, открытому из навигации. */
export function useDocsPageHighlight() {
  const [highlightDocumentId, setHighlightDocumentId] = useState<string | null>(null);
  const highlightDisplayTimerRef = useRef<number | null>(null);
  const highlightFallbackTimerRef = useRef<number | null>(null);

  /** Сбрасывает таймеры показа и fallback-подсветки. */
  const clearHighlightTimers = useCallback(() => {
    if (highlightDisplayTimerRef.current != null) {
      window.clearTimeout(highlightDisplayTimerRef.current);
    }
    if (highlightFallbackTimerRef.current != null) {
      window.clearTimeout(highlightFallbackTimerRef.current);
    }
    highlightDisplayTimerRef.current = null;
    highlightFallbackTimerRef.current = null;
  }, []);

  /** Callback-ref строки таблицы: прокручивает к ней и снимает подсветку после показа. */
  const handleHighlightRowRef = useCallback((node: HTMLTableRowElement | null) => {
    if (!node) return;
    if (highlightFallbackTimerRef.current != null) {
      window.clearTimeout(highlightFallbackTimerRef.current);
      highlightFallbackTimerRef.current = null;
    }
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (highlightDisplayTimerRef.current != null) {
      window.clearTimeout(highlightDisplayTimerRef.current);
    }
    highlightDisplayTimerRef.current = window.setTimeout(() => setHighlightDocumentId(null), 2400);
  }, []);

  /** Запускает fallback-снятие подсветки, если целевая строка не была отрендерена. */
  const scheduleHighlightFallback = useCallback(() => {
    if (highlightFallbackTimerRef.current != null) {
      window.clearTimeout(highlightFallbackTimerRef.current);
    }
    highlightFallbackTimerRef.current = window.setTimeout(() => setHighlightDocumentId(null), 5000);
  }, []);

  /** Полностью сбрасывает подсветку и связанные таймеры. */
  const resetHighlight = useCallback(() => {
    clearHighlightTimers();
    setHighlightDocumentId(null);
  }, [clearHighlightTimers]);

  // Очистка таймеров при размонтировании хука/страницы.
  useEffect(() => () => clearHighlightTimers(), [clearHighlightTimers]);

  return {
    highlightDocumentId,
    setHighlightDocumentId,
    handleHighlightRowRef,
    clearHighlightTimers,
    resetHighlight,
    scheduleHighlightFallback,
  };
}
