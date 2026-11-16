import { useCallback, useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { MAIL_LETTER_NOT_FOUND_NOTE } from '@/features/mail/mail-thread-labels';

/**
 * Флеш-подсветка строки реестра после перехода из дерева переписки.
 *
 * По образцу `AutoExpandOnHighlight` в реестре счетов: первого прохода может
 * не хватить — прыжок меняет фильтры, и строка появляется только после
 * перезапроса, поэтому через 120 мс селектор ищется ещё раз.
 */
export function useMailSectionHighlight() {
  const [highlightedMailId, setHighlightedMailId] = useState<string | null>(null);
  const [highlightRequestId, setHighlightRequestId] = useState(0);

  const requestHighlight = (mailId: string): void => {
    setHighlightedMailId(mailId);
    setHighlightRequestId((prev) => prev + 1);
  };

  const clearHighlight = useCallback(() => {
    setHighlightedMailId(null);
  }, []);

  useEffect(() => {
    if (!highlightedMailId) return;
    const selector = `[data-highlight-id="${CSS.escape(highlightedMailId)}"]`;

    const flash = (el: Element) => {
      if (!el.classList.contains('row-flash')) el.classList.add('row-flash');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const find = (): Element | null => {
      for (const el of document.querySelectorAll(selector)) {
        // Таблица и карточки обе всегда в DOM и разведены `visibleFrom`
        // только стилями, поэтому невидимую ветку подсветка не трогает.
        if (getComputedStyle(el).display !== 'none') return el;
      }
      return null;
    };

    const el = find();
    if (el) {
      flash(el);
      const release = window.setTimeout(() => {
        el.classList.remove('row-flash');
        clearHighlight();
      }, 2600);
      return () => window.clearTimeout(release);
    }

    const retry = window.setTimeout(() => {
      const found = find();
      if (found) flash(found);
      else
        notifications.show({
          color: 'yellow',
          message: MAIL_LETTER_NOT_FOUND_NOTE,
        });
    }, 120);
    return () => window.clearTimeout(retry);
  }, [highlightedMailId, highlightRequestId, clearHighlight]);

  return { highlightedMailId, requestHighlight };
}
