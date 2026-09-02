import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBeforeUnloadGuard } from './useBeforeUnloadGuard';

function fireBeforeUnload(): BeforeUnloadEvent {
  const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

describe('useBeforeUnloadGuard', () => {
  it('marks beforeunload events as cancellable when active', () => {
    const { result } = renderHook(() => useBeforeUnloadGuard(true));
    expect(result.current).toBeUndefined();

    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(true);
  });

  it('does nothing when inactive', () => {
    renderHook(() => useBeforeUnloadGuard(false));

    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });

  it('removes the listener when active flips to false', () => {
    const { rerender } = renderHook(({ active }) => useBeforeUnloadGuard(active), {
      initialProps: { active: true },
    });
    rerender({ active: false });

    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });
});
