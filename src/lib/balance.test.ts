import { describe, expect, it } from 'vitest';
import { CLASS_SLUGS } from './skilltree/types';
import { NO_FILTERS, buildReport, distinct, filterTests, fmtPct, fmtRate, formatDuration, parseDuration, testRate, type BalanceTest } from './balance';

let n = 0;
const t = (cls: BalanceTest['cls'], mobs: number, seconds: number, extra: Partial<BalanceTest> = {}): BalanceTest =>
  ({ id: `t${++n}`, cls, mobs, seconds, tester: 'Ana', level: 100, place: 'Oasis', notes: '', testedOn: '2026-11-17', createdAt: '', ...extra });

describe('speed', () => {
  it('is mobs per minute', () => {
    expect(testRate({ mobs: 30, seconds: 60 })).toBe(30);
    expect(testRate({ mobs: 10, seconds: 120 })).toBe(5);
  });
});

describe('report', () => {
  it('ranks the classes by pooled speed (total mobs / total minutes), fastest first', () => {
    const r = buildReport([t('magician', 60, 60), t('magician', 120, 120), t('fighter', 30, 60)], CLASS_SLUGS);
    expect(r.ranking.map((c) => c.cls)).toEqual(['magician', 'fighter']);
    expect(r.ranking[0].rate).toBeCloseTo(60, 6);
    expect(r.ranking[1].rate).toBeCloseTo(30, 6);
  });
  it('a long test weighs more than a short one', () => {
    const r = buildReport([t('knight', 100, 100), t('knight', 1, 10)], CLASS_SLUGS);
    // (101 mobs) / (110 s) = 55.09/min, not the mean of 60 and 6
    expect(r.ranking[0].rate).toBeCloseTo(55.0909, 3);
    expect(r.ranking[0].best).toBeCloseTo(60, 6);
    expect(r.ranking[0].worst).toBeCloseTo(6, 6);
  });
  it('compares every class with the average of the classes that have tests, and finds the strongest and the weakest', () => {
    const r = buildReport([t('archer', 60, 60), t('priestess', 20, 60), t('shaman', 40, 60)], CLASS_SLUGS);
    expect(r.average).toBeCloseTo(40, 6);
    expect(r.strongest?.cls).toBe('archer');
    expect(r.weakest?.cls).toBe('priestess');
    expect(r.ranking.find((c) => c.cls === 'archer')!.vsAverage).toBeCloseTo(50, 6);
    expect(r.ranking.find((c) => c.cls === 'priestess')!.vsAverage).toBeCloseTo(-50, 6);
    expect(r.spread).toBeCloseTo(3, 6);
  });
  it('lists the classes with no test, and has no weakest or spread with a single class', () => {
    const r = buildReport([t('assassin', 10, 60)], CLASS_SLUGS);
    expect(r.untested).toHaveLength(9);
    expect(r.untested).not.toContain('assassin');
    expect(r.weakest).toBeNull();
    expect(r.spread).toBeNull();
    expect(r.ranking[0].vsAverage).toBe(0);
  });
  it('counts testers per class (same name in any case is one person)', () => {
    const r = buildReport([t('pikeman', 10, 60, { tester: 'Ana' }), t('pikeman', 10, 60, { tester: ' ana ' }), t('pikeman', 10, 60, { tester: 'Beto' })], CLASS_SLUGS);
    expect(r.ranking[0].testers).toBe(2);
    expect(r.ranking[0].tests).toBe(3);
  });
  it('warns when places or levels are mixed', () => {
    expect(buildReport([t('fighter', 1, 1, { place: 'A' }), t('knight', 1, 1, { place: 'B' })], CLASS_SLUGS).mixedPlaces).toBe(true);
    expect(buildReport([t('fighter', 1, 1), t('knight', 1, 1)], CLASS_SLUGS).mixedPlaces).toBe(false);
    expect(buildReport([t('fighter', 1, 1, { level: 90 }), t('knight', 1, 1, { level: 100 })], CLASS_SLUGS).mixedLevels).toBe(true);
  });
  it('is empty without tests', () => {
    const r = buildReport([], CLASS_SLUGS);
    expect(r.ranking).toEqual([]);
    expect(r.strongest).toBeNull();
    expect(r.untested).toHaveLength(10);
  });
});

describe('filters', () => {
  const all = [t('fighter', 1, 1, { place: 'Oasis', tester: 'Ana', level: 100 }), t('archer', 1, 1, { place: 'Ice Mine', tester: 'Beto', level: 80 }), t('knight', 1, 1, { place: 'oasis', tester: 'ana', level: null })];
  it('by place and tester, ignoring case', () => {
    expect(filterTests(all, { ...NO_FILTERS, place: 'OASIS' })).toHaveLength(2);
    expect(filterTests(all, { ...NO_FILTERS, tester: 'beto' })).toHaveLength(1);
  });
  it('by level range (tests with no level are left out when a range is set)', () => {
    expect(filterTests(all, { ...NO_FILTERS, minLevel: 90 })).toHaveLength(1);
    expect(filterTests(all, { ...NO_FILTERS, maxLevel: 90 })).toHaveLength(1);
    expect(filterTests(all, { ...NO_FILTERS, minLevel: 1, maxLevel: 200 })).toHaveLength(2);
    expect(filterTests(all, NO_FILTERS)).toHaveLength(3);
  });
  it('distinct keeps one spelling per name, sorted', () => {
    expect(distinct(['Oasis', 'oasis ', 'Ice Mine', ''])).toEqual(['Ice Mine', 'Oasis']);
  });
});

describe('time and number formatting', () => {
  it('reads mm:ss, h:mm:ss and plain minutes', () => {
    expect(parseDuration('12:30')).toBe(750);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('5')).toBe(300);
    expect(parseDuration('2,5')).toBe(150);
  });
  it('refuses what it cannot read', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('12:75')).toBeNull();
    expect(parseDuration('0:00')).toBeNull();
    expect(parseDuration('1:2:3:4')).toBeNull();
  });
  it('shows time and numbers the Brazilian way', () => {
    expect(formatDuration(750)).toBe('12:30');
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(fmtRate(12.34)).toBe('12,3');
    expect(fmtPct(35.4)).toBe('+35%');
    expect(fmtPct(-47.6)).toBe('−48%');
  });
});
