import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';

interface DatePinnedContextValue {
  pinned: boolean;
  registerAnchor: (el: HTMLElement | null) => (() => void) | undefined;
}

const DatePinnedContext = createContext<DatePinnedContextValue | null>(null);

function getHeaderRootMargin(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--app-shell-header-height',
  );
  const px = Number.parseFloat(raw);
  const top = Number.isFinite(px) ? px : 0;
  return `-${top}px 0px -32px 0px`;
}

export function DatePinnedProvider({ children }: { children: ReactNode }) {
  const [pinned, setPinned] = useState(false);

  const registerAnchor = useCallback((el: HTMLElement | null) => {
    if (!el) {
      setPinned(false);
      return undefined;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setPinned(false);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setPinned(!entry.isIntersecting);
      },
      { rootMargin: getHeaderRootMargin() },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      setPinned(false);
    };
  }, []);

  return (
    <DatePinnedContext.Provider value={{ pinned, registerAnchor }}>
      {children}
    </DatePinnedContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDatePinned() {
  const ctx = useContext(DatePinnedContext);
  if (!ctx) throw new Error('useDatePinned must be used within DatePinnedProvider');
  return ctx;
}
