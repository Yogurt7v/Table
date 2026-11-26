import { afterEach, describe, expect, it, vi } from 'vitest';
import { findVisibleHighlightEl, flashHighlightRow } from './invoice-section-highlight';

function attachEl(id: string, visible: boolean, tag = 'div'): HTMLElement {
  const el = document.createElement(tag);
  el.setAttribute('data-highlight-id', id);
  el.getClientRects = () => (visible ? ([{}] as unknown as DOMRectList) : ([] as unknown as DOMRectList));
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('invoice-section-highlight', () => {
  it('returns visible element when first match is hidden mobile duplicate', () => {
    attachEl('inv1', false);
    const desktop = attachEl('inv1', true, 'tr');

    expect(findVisibleHighlightEl('inv1')).toBe(desktop);
  });

  it('returns null when no visible element exists', () => {
    attachEl('inv1', false);
    expect(findVisibleHighlightEl('inv1')).toBeNull();
  });

  it('adds row-flash to visible element and removes it after timeout', () => {
    vi.useFakeTimers();
    attachEl('inv1', false);
    const desktop = attachEl('inv1', true, 'tr');

    flashHighlightRow('inv1');

    expect(desktop.classList.contains('row-flash')).toBe(true);
    vi.advanceTimersByTime(2600);
    expect(desktop.classList.contains('row-flash')).toBe(false);
  });

  it('does not add duplicate row-flash class', () => {
    vi.useFakeTimers();
    const desktop = attachEl('inv1', true, 'tr');
    desktop.classList.add('row-flash');

    flashHighlightRow('inv1');
    vi.advanceTimersByTime(2600);

    expect(desktop.classList.contains('row-flash')).toBe(true);
  });
});
