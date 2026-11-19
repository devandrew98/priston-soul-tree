import { describe, expect, it } from 'vitest';
import { CLASS_SLUGS, type ClassSlug } from './skilltree/types';
import { NO_FILTERS, buildReport, isStale, needRetest, type BalanceChange, distinct, filterTests, fmtPct, fmtRate, formatDuration, parseDuration, rankTests, sortPatches, testRate, toggleValue, type BalanceTest } from './balance';

let n = 0;
const t = (cls: BalanceTest['cls'], mobs: number, seconds: number, extra: Partial<BalanceTest> = {}): BalanceTest =>
  ({ id: `t${++n}`, cls, mobs, seconds, tester: 'Ana', level: 100, place: 'Oasis', notes: '', patch: '', testedOn: '2026-11-17', createdAt: '', mode: 'aoe', ...extra });

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
  it('warns when AoE and 1v1 (or a test with no mode) are mixed', () => {
    expect(buildReport([t('fighter', 1, 1, { mode: 'aoe' }), t('knight', 1, 1, { mode: 'single' })], CLASS_SLUGS).mixedModes).toBe(true);
    expect(buildReport([t('fighter', 1, 1, { mode: 'aoe' }), t('knight', 1, 1, { mode: null })], CLASS_SLUGS).mixedModes).toBe(true);
    expect(buildReport([t('fighter', 1, 1, { mode: 'aoe' }), t('knight', 1, 1, { mode: 'aoe' })], CLASS_SLUGS).mixedModes).toBe(false);
  });
  it('is empty without tests', () => {
    const r = buildReport([], CLASS_SLUGS);
    expect(r.ranking).toEqual([]);
    expect(r.strongest).toBeNull();
    expect(r.untested).toHaveLength(10);
  });
});

describe('changes make tests out of date', () => {
  const ch = (cls: ClassSlug | null, on: string): BalanceChange => ({ id: `${cls}${on}`, cls, on, patch: '', note: '' });
  const old = t('fighter', 1, 1, { testedOn: '2026-10-20' });
  it('a change of the class after the test makes it stale; other classes are untouched', () => {
    expect(isStale(old, [ch('fighter', '2026-11-05')])).toBe(true);
    expect(isStale(old, [ch('archer', '2026-11-05')])).toBe(false);
  });
  it('a general change makes every class stale', () => {
    expect(isStale(old, [ch(null, '2026-11-05')])).toBe(true);
    expect(isStale(t('knight', 1, 1, { testedOn: '2026-10-20' }), [ch(null, '2026-11-05')])).toBe(true);
  });
  it('a change before or on the day of the test does not matter', () => {
    expect(isStale(old, [ch('fighter', '2026-10-20'), ch('fighter', '2026-10-01')])).toBe(false);
  });
  it('lists classes changed with no up-to-date test, oldest change first', () => {
    const tests = [t('fighter', 1, 1, { testedOn: '2026-10-20' }), t('fighter', 1, 1, { testedOn: '2026-11-08' }), t('archer', 1, 1, { testedOn: '2026-10-20' })];
    const changes = [ch('fighter', '2026-11-05'), ch('archer', '2026-11-02')];
    expect(needRetest(tests, changes, CLASS_SLUGS).map((x) => x.cls)).toEqual(['archer']);
    expect(needRetest(tests, [...changes, ch(null, '2026-11-20')], CLASS_SLUGS).map((x) => x.cls)).toHaveLength(CLASS_SLUGS.length);
    expect(needRetest(tests, [], CLASS_SLUGS)).toEqual([]);
  });
});

describe('filters', () => {
  const all = [t('fighter', 1, 1, { patch: '1.0', tester: 'Ana' }), t('archer', 1, 1, { patch: '1.1', tester: 'Beto' }), t('knight', 1, 1, { patch: '1.1', tester: 'ana' })];
  it('by tester and patch, ignoring case', () => {
    expect(filterTests(all, { ...NO_FILTERS, testers: ['beto'] })).toHaveLength(1);
    expect(filterTests(all, { ...NO_FILTERS, patches: ['1.1'] })).toHaveLength(2);
  });
  it('several testers / patches can be picked at once', () => {
    expect(filterTests(all, { ...NO_FILTERS, testers: ['Ana', 'Beto'] })).toHaveLength(3);
    expect(filterTests(all, { ...NO_FILTERS, patches: ['1.0', '1.1'] })).toHaveLength(3);
    expect(filterTests(all, { ...NO_FILTERS, testers: ['Ana', 'Beto'], patches: ['1.1'] }).map((x) => x.cls)).toEqual(['archer', 'knight']);
  });
  it('tester and patch together cross the two', () => {
    expect(filterTests(all, { ...NO_FILTERS, testers: ['ANA'], patches: ['1.1'] }).map((x) => x.cls)).toEqual(['knight']);
  });
  it('toggleValue adds and removes', () => {
    expect(toggleValue([], 'Ana')).toEqual(['Ana']);
    expect(toggleValue(['Ana', 'Beto'], 'ana')).toEqual(['Beto']);
  });
  it('by mode (AoE or 1v1)', () => {
    const m = [t('fighter', 1, 1, { mode: 'aoe' }), t('archer', 1, 1, { mode: 'single' }), t('knight', 1, 1, { mode: null })];
    expect(filterTests(m, { ...NO_FILTERS, mode: 'aoe' }).map((x) => x.cls)).toEqual(['fighter']);
    expect(filterTests(m, { ...NO_FILTERS, mode: 'single' }).map((x) => x.cls)).toEqual(['archer']);
    expect(filterTests(m, NO_FILTERS)).toHaveLength(3);
  });
  it('no filters keeps everything', () => {
    expect(filterTests(all, NO_FILTERS)).toHaveLength(3);
  });
  it('sorts patch versions numerically, newest first', () => {
    expect(sortPatches(['1.9', '1.10', '1.2', '2.0'])).toEqual(['2.0', '1.10', '1.9', '1.2']);
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
    expect(fmtRate(12.34, 'en')).toBe('12.3');
    expect(fmtPct(35.4)).toBe('+35%');
    expect(fmtPct(-47.6)).toBe('−48%');
  });
});

describe('ranking of single tests (never added up)', () => {
  it('keeps two tests of the same class and map as two rows, fastest first', () => {
    const r = rankTests([t('magician', 60, 240, { tester: 'Beto' }), t('magician', 120, 300, { tester: 'Ana' }), t('fighter', 30, 60)]);
    expect(r.map((x) => [x.test.cls, x.test.tester, x.rate])).toEqual([['fighter', 'Ana', 30], ['magician', 'Ana', 24], ['magician', 'Beto', 15]]);
  });
  it('compares each test with the average of the tests', () => {
    const r = rankTests([t('archer', 30, 60), t('knight', 10, 60)]);
    expect(r[0].vsAverage).toBeCloseTo(50, 6);
    expect(r[1].vsAverage).toBeCloseTo(-50, 6);
    expect(rankTests([t('archer', 30, 60)])[0].vsAverage).toBe(0);
  });
  it('a tie shows the newer test first, and no tests gives no rows', () => {
    const r = rankTests([t('archer', 30, 60, { testedOn: '2026-11-10' }), t('knight', 30, 60, { testedOn: '2026-11-15' })]);
    expect(r.map((x) => x.test.cls)).toEqual(['knight', 'archer']);
    expect(rankTests([])).toEqual([]);
  });
});
