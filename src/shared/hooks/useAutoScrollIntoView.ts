import { useEffect, useRef } from 'react';

interface UseAutoScrollIntoViewOptions {
  enabled?: boolean;
  block?: ScrollLogicalPosition;
}

export function useAutoScrollIntoView<T extends HTMLElement>({
  enabled = true,
  block = 'center',
}: UseAutoScrollIntoViewOptions = {}) {
  const ref = useRef<T | null>(null);
  const wasEnabled = useRef(false);

  useEffect(() => {
    if (enabled === wasEnabled.current) return;
    wasEnabled.current = enabled;
    if (!enabled) return;

    const el = ref.current;
    if (!el || getComputedStyle(el).display === 'none') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.scrollIntoView({ behavior, block });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [enabled, block]);

  return ref;
}