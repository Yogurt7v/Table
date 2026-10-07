import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadColumnSizing,
  resolveColumnShares,
  saveColumnSizing,
  TOTAL_SHARE,
} from './mail-table-column-sizing';
import { ALL_MAIL_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from './mail-columns';
import type { MailColumnId } from './mail-columns';

const ALL_IDS = ALL_MAIL_COLUMNS.map((column) => column.id);

function totalOf(shares: Map<MailColumnId, number>): number {
  let total = 0;
  for (const share of shares.values()) total += share;
  return total;
}

describe('mail-table-column-sizing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty object when nothing stored', () => {
    expect(loadColumnSizing('org1')).toEqual({});
  });

  it('round-trips column widths via localStorage', () => {
    const sizing = { subject: 22.5, counterparty: 18 };
    saveColumnSizing('org1', sizing);
    expect(loadColumnSizing('org1')).toEqual(sizing);
  });

  it('returns empty object for invalid JSON', () => {
    localStorage.setItem('mail-table-column-sizing:org1', 'not-json');
    expect(loadColumnSizing('org1')).toEqual({});
  });

  it('returns empty object for a stored array', () => {
    localStorage.setItem('mail-table-column-sizing:org1', JSON.stringify([1, 2, 3]));
    expect(loadColumnSizing('org1')).toEqual({});
  });

  it('ignores non-numeric values in stored JSON', () => {
    localStorage.setItem(
      'mail-table-column-sizing:org1',
      JSON.stringify({ subject: 100, counterparty: 'wide', date: null }),
    );
    expect(loadColumnSizing('org1')).toEqual({ subject: 100 });
  });

  it('ignores values that parse to Infinity', () => {
    // `1e999` — единственное не-конечное число, которое переживает JSON.parse,
    // поэтому обычный `typeof === 'number'` его бы пропустил.
    localStorage.setItem('mail-table-column-sizing:org1', '{"subject":1e999,"counterparty":12}');
    expect(loadColumnSizing('org1')).toEqual({ counterparty: 12 });
  });

  it('uses separate keys per organization', () => {
    saveColumnSizing('org-a', { subject: 10 });
    saveColumnSizing('org-b', { subject: 20 });
    expect(loadColumnSizing('org-a')).toEqual({ subject: 10 });
    expect(loadColumnSizing('org-b')).toEqual({ subject: 20 });
  });

  it('gives every visible column a share and a total of 100', () => {
    const shares = resolveColumnShares(DEFAULT_VISIBLE_COLUMNS, {});
    expect([...shares.keys()]).toEqual(DEFAULT_VISIBLE_COLUMNS);
    expect(totalOf(shares)).toBeCloseTo(TOTAL_SHARE, 6);
    for (const share of shares.values()) expect(share).toBeGreaterThan(0);
  });

  it('hands a dragged column its share and keeps the total at 100', () => {
    const shares = resolveColumnShares(DEFAULT_VISIBLE_COLUMNS, { subject: 30 });
    expect(shares.get('subject')).toBeCloseTo(30, 6);
    expect(totalOf(shares)).toBeCloseTo(TOTAL_SHARE, 6);
  });

  it('gives the free columns the remainder in proportion to their weights', () => {
    const pinned = resolveColumnShares(DEFAULT_VISIBLE_COLUMNS, { subject: 20 });
    const baseline = resolveColumnShares(DEFAULT_VISIBLE_COLUMNS, {});
    // Растянутая колонка забирает 20% и более, остальные теряют ровно эту долю.
    expect(pinned.get('counterparty')!).toBeLessThan(baseline.get('counterparty')!);
    // Отношение долей двух свободных колонок равно отношению их весов — «Контрагент»
    // (132) против «Ответственного» (100) даёт ровно 1.32 при любой ширине.
    const ratio = pinned.get('counterparty')! / pinned.get('responsible_name')!;
    expect(ratio).toBeCloseTo(132 / 100, 6);
  });

  it('normalises over the visible set so hidden columns leave no gap', () => {
    const visible: MailColumnId[] = ['seq', 'date'];
    const shares = resolveColumnShares(visible, {});
    expect([...shares.keys()]).toEqual(visible);
    expect(totalOf(shares)).toBeCloseTo(TOTAL_SHARE, 6);
  });

  it('scales stored shares down instead of overflowing the table', () => {
    const shares = resolveColumnShares(DEFAULT_VISIBLE_COLUMNS, {
      subject: 80,
      counterparty: 70,
    });
    expect(totalOf(shares)).toBeCloseTo(TOTAL_SHARE, 6);
    for (const share of shares.values()) expect(share).toBeGreaterThan(0);
  });

  it('clamps a single absurd share and still leaves room for the rest', () => {
    const shares = resolveColumnShares(DEFAULT_VISIBLE_COLUMNS, { subject: 1000 });
    expect(shares.get('subject')!).toBeLessThan(TOTAL_SHARE);
    expect(shares.get('date')!).toBeGreaterThan(0);
    expect(totalOf(shares)).toBeCloseTo(TOTAL_SHARE, 6);
  });

  it('fills the whole table when every visible column is pinned', () => {
    const pinned = Object.fromEntries(ALL_IDS.map((id) => [id, 10]));
    const shares = resolveColumnShares(ALL_IDS, pinned);
    expect(shares.size).toBe(ALL_IDS.length);
    expect(totalOf(shares)).toBeCloseTo(TOTAL_SHARE, 6);
  });

  it('treats a zero or negative stored share as absent', () => {
    const shares = resolveColumnShares(DEFAULT_VISIBLE_COLUMNS, { subject: 0, date: -5 });
    const baseline = resolveColumnShares(DEFAULT_VISIBLE_COLUMNS, {});
    expect(shares.get('subject')).toBeCloseTo(baseline.get('subject')!, 6);
    expect(shares.get('date')).toBeCloseTo(baseline.get('date')!, 6);
    expect(totalOf(shares)).toBeCloseTo(TOTAL_SHARE, 6);
  });

  it('ignores overrides for columns that are not visible', () => {
    const shares = resolveColumnShares(['seq', 'date'], { subject: 40, actions: 30 });
    expect(shares.has('subject')).toBe(false);
    expect(shares.has('actions')).toBe(false);
    expect(totalOf(shares)).toBeCloseTo(TOTAL_SHARE, 6);
  });

  it('returns nothing for an empty visible set', () => {
    expect(resolveColumnShares([], { subject: 40 }).size).toBe(0);
  });
});
