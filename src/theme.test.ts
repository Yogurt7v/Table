import { describe, it, expect } from 'vitest';
import { theme } from './theme';

describe('theme', () => {
  it('экспортирует объект темы Mantine', () => {
    expect(theme).toBeDefined();
    expect(typeof theme).toBe('object');
  });

  it('primaryColor по умолчанию — blue', () => {
    expect(theme.primaryColor).toBe('blue');
  });

  it('defaultRadius — md', () => {
    expect(theme.defaultRadius).toBe('md');
  });

  it('fontFamily содержит Inter Variable', () => {
    expect(theme.fontFamily).toContain('Inter Variable');
  });

  it('fontFamilyMonospace содержит ui-monospace', () => {
    expect(theme.fontFamilyMonospace).toContain('ui-monospace');
  });

  it('headings.fontWeight — 700', () => {
    expect(theme.headings?.fontWeight).toBe('700');
  });
});
