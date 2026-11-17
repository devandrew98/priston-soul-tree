// Class balance tests (/balance): the rules that turn the notes into a ranking. Everything is computed from the saved tests only.
// A test = one class killed `mobs` monsters in `seconds`. Its speed is mobs per minute.
// A class's score pools all its tests (total mobs / total minutes), so a long test weighs more than a short one.
import type { ClassSlug } from './skilltree/types';

export interface BalanceTest {
  id: string;
  cls: ClassSlug;
  mobs: number;
  seconds: number;
  tester: string;
  level: number | null;
  place: string;
  notes: string;
  testedOn: string; // YYYY-MM-DD
  /** aoe = several mobs at once, single = one target (1v1); null for tests written before the mode existed. */
  mode: Mode | null;
  createdAt: string;
}

export type Mode = 'aoe' | 'single';
export const MODES: Mode[] = ['aoe', 'single'];

export interface Filters { place: string; tester: string; minLevel: number | null; maxLevel: number | null; mode: Mode | '' }
export const NO_FILTERS: Filters = { place: '', tester: '', minLevel: null, maxLevel: null, mode: '' };

/** Mobs killed per minute in one test. */
export const testRate = (t: Pick<BalanceTest, 'mobs' | 'seconds'>): number => (t.mobs / t.seconds) * 60;

export interface ClassStat {
  cls: ClassSlug;
  tests: number;
  mobs: number;
  seconds: number;
  /** Pooled speed: total mobs / total minutes. */
  rate: number;
  best: number;
  worst: number;
  testers: number;
  /** % above (+) or below (-) the average speed of the classes that have tests; 0 when there is only one class. */
  vsAverage: number;
}

export function filterTests(tests: BalanceTest[], f: Filters): BalanceTest[] {
  const place = f.place.trim().toLowerCase();
  const tester = f.tester.trim().toLowerCase();
  return tests.filter((t) =>
    (!place || t.place.trim().toLowerCase() === place) &&
    (!tester || t.tester.trim().toLowerCase() === tester) &&
    (!f.mode || t.mode === f.mode) &&
    (f.minLevel === null || (t.level !== null && t.level >= f.minLevel)) &&
    (f.maxLevel === null || (t.level !== null && t.level <= f.maxLevel)));
}

export interface Report {
  /** Classes that have at least one test, fastest first. */
  ranking: ClassStat[];
  /** Classes of the game with no test in the current selection. */
  untested: ClassSlug[];
  average: number;
  strongest: ClassStat | null;
  weakest: ClassStat | null;
  /** strongest speed / weakest speed (null with fewer than two classes). */
  spread: number | null;
  totalTests: number;
  /** Several different places in the selection: the comparison may be unfair. */
  mixedPlaces: boolean;
  mixedLevels: boolean;
  /** AoE and 1v1 tests together (or tests with no mode next to tests with one): not a fair comparison. */
  mixedModes: boolean;
}

export function buildReport(tests: BalanceTest[], allClasses: ClassSlug[]): Report {
  const by = new Map<ClassSlug, BalanceTest[]>();
  for (const t of tests) (by.get(t.cls) ?? by.set(t.cls, []).get(t.cls)!).push(t);

  const base = [...by.entries()].map(([cls, list]) => {
    const mobs = list.reduce((a, t) => a + t.mobs, 0);
    const seconds = list.reduce((a, t) => a + t.seconds, 0);
    const rates = list.map(testRate);
    return { cls, tests: list.length, mobs, seconds, rate: (mobs / seconds) * 60, best: Math.max(...rates), worst: Math.min(...rates), testers: new Set(list.map((t) => t.tester.trim().toLowerCase())).size };
  });
  const average = base.length ? base.reduce((a, c) => a + c.rate, 0) / base.length : 0;
  const ranking: ClassStat[] = base
    .map((c) => ({ ...c, vsAverage: base.length > 1 && average > 0 ? (c.rate / average - 1) * 100 : 0 }))
    .sort((a, b) => b.rate - a.rate || a.cls.localeCompare(b.cls));

  const places = new Set(tests.map((t) => t.place.trim().toLowerCase()));
  const levels = new Set(tests.map((t) => t.level));
  return {
    ranking,
    untested: allClasses.filter((c) => !by.has(c)),
    average,
    strongest: ranking[0] ?? null,
    weakest: ranking.length > 1 ? ranking[ranking.length - 1] : null,
    spread: ranking.length > 1 && ranking[ranking.length - 1].rate > 0 ? ranking[0].rate / ranking[ranking.length - 1].rate : null,
    totalTests: tests.length,
    mixedPlaces: places.size > 1,
    mixedLevels: levels.size > 1,
    mixedModes: new Set(tests.map((t) => t.mode)).size > 1,
  };
}

/** Distinct values (case-insensitive, first spelling wins), sorted, for the filters and suggestions. */
export function distinct(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const v of values.map((x) => x.trim()).filter(Boolean)) if (!seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** "mm:ss" or "h:mm:ss" or plain minutes ("12", "12,5") to seconds; null when it cannot be read. */
export function parseDuration(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!s) return null;
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => p.trim());
    if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
    const nums = parts.map(Number);
    const [h, m, sec] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
    if (sec >= 60 || (nums.length === 3 && m >= 60)) return null;
    const total = h * 3600 + m * 60 + sec;
    return total > 0 ? total : null;
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const total = Math.round(Number(s) * 60);
  return total > 0 ? total : null;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 12.345 -> "12,3" in Portuguese (decimal comma) and "12.3" in English. */
export const fmtRate = (n: number, lang: 'pt' | 'en' = 'pt'): string => (lang === 'en' ? n.toFixed(1) : n.toFixed(1).replace('.', ','));
export const fmtPct = (n: number): string => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(0)}%`;

export interface TestRank {
  test: BalanceTest;
  /** Mobs per minute of this one test. */
  rate: number;
  /** % above (+) or below (-) the average speed of all the tests in the selection; 0 with a single test. */
  vsAverage: number;
}

/** Every test is its own entry (two tests of the same class on the same map stay two rows, never added up), fastest first; ties: the newer test first. */
export function rankTests(tests: BalanceTest[]): TestRank[] {
  const rates = tests.map(testRate);
  const average = rates.length ? rates.reduce((a, r) => a + r, 0) / rates.length : 0;
  return tests
    .map((test, i) => ({ test, rate: rates[i], vsAverage: tests.length > 1 && average > 0 ? (rates[i] / average - 1) * 100 : 0 }))
    .sort((a, b) => b.rate - a.rate || b.test.testedOn.localeCompare(a.test.testedOn) || b.test.createdAt.localeCompare(a.test.createdAt));
}
