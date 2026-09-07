import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useAutoScrollIntoView } from './useAutoScrollIntoView';

const scrollIntoView = vi.fn<(options?: ScrollIntoViewOptions) => void>();

function Target({ enabled }: { enabled: boolean }) {
  const ref = useAutoScrollIntoView<HTMLDivElement>({ enabled });
  return <div data-testid="target" ref={ref} />;
}

function rAF(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

beforeEach(() => {
  scrollIntoView.mockClear();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollIntoView,
  });
});

describe('useAutoScrollIntoView', () => {
  it('scrolls into view when enabled turns true', async () => {
    const { rerender } = render(<Target enabled={false} />);
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(<Target enabled />);

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    });
  });

  it('does not scroll when enabled stays false', async () => {
    render(<Target enabled={false} />);

    await rAF();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('re-scrolls on each enable transition', async () => {
    const { rerender } = render(<Target enabled={false} />);

    rerender(<Target enabled />);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    rerender(<Target enabled={false} />);
    await rAF();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(<Target enabled />);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
  });

  it('uses instant behavior when user prefers reduced motion', async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    try {
      const { rerender } = render(<Target enabled={false} />);
      rerender(<Target enabled />);

      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
      });
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});