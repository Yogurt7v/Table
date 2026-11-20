import { describe, it, expect, beforeEach } from 'vitest';
import { loadColumnSizing, saveColumnSizing } from './invoice-table-column-sizing';

describe('invoice-table-column-sizing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty object when nothing stored', () => {
    expect(loadColumnSizing('org1')).toEqual({});
  });

  it('round-trips column widths via localStorage', () => {
    const sizing = { counterparty: 220, purpose: 300 };
    saveColumnSizing('org1', sizing);
    expect(loadColumnSizing('org1')).toEqual(sizing);
  });

  it('returns empty object for invalid JSON', () => {
    localStorage.setItem('invoice-table-column-sizing:org1', 'not-json');
    expect(loadColumnSizing('org1')).toEqual({});
  });

  it('ignores non-numeric values in stored JSON', () => {
    localStorage.setItem(
      'invoice-table-column-sizing:org1',
      JSON.stringify({ counterparty: 100, purpose: 'wide', amount: null }),
    );
    expect(loadColumnSizing('org1')).toEqual({ counterparty: 100 });
  });

  it('uses separate keys per organization', () => {
    saveColumnSizing('org-a', { counterparty: 100 });
    saveColumnSizing('org-b', { counterparty: 200 });
    expect(loadColumnSizing('org-a')).toEqual({ counterparty: 100 });
    expect(loadColumnSizing('org-b')).toEqual({ counterparty: 200 });
  });
});
