import { describe, expect, it } from 'vitest';
import { addExp, comparePos, expBetween, makeExpTable, mulDiv, percentToExp, pctToState, statePct, validateExpRows } from './exp';
import type { ExpLevel } from './types';

// Made-up numbers, only for the tests (they are NOT game values).
const rows = (values: Record<number, number>): ExpLevel[] => Object.entries(values).map(([level, value]) => ({ level: Number(level), value, active: true }));
const perLevel = makeExpTable(rows({ 68: 1000, 69: 2000, 70: 3000, 71: 4000 }), 'per_level');

describe('mulDiv', () => {
  it('is exact where floating point is not', () => {
    expect(mulDiv(1_000_000_007, 7, 10)).toBe(700_000_004);
    expect(mulDiv(9_007_199_254_740_991, 3, 3)).toBe(9_007_199_254_740_991); // beyond double precision for the product
    expect(mulDiv(10, 1, 3, 'floor')).toBe(3);
    expect(mulDiv(10, 1, 3, 'ceil')).toBe(4);
    expect(mulDiv(5, 1, 2, 'round')).toBe(3);
    expect(mulDiv(7, 1, 3, 'round')).toBe(2);
  });
});

describe('percentages', () => {
  it('percentToExp keeps the decimals', () => {
    expect(percentToExp(2000, 72)).toBe(1440);
    expect(percentToExp(2000, 12.5)).toBe(250);
    expect(percentToExp(3, 33.3333)).toBe(1);
  });
  it('a typed percentage never reaches the next level', () => {
    expect(pctToState(perLevel, 69, 100)).toEqual({ level: 69, exp: 1999 });
    expect(pctToState(perLevel, 69, 0)).toEqual({ level: 69, exp: 0 });
  });
  it('0% does not need the level in the table, other values do', () => {
    expect(pctToState(perLevel, 200, 0)).toEqual({ level: 200, exp: 0 });
    expect(pctToState(perLevel, 200, 10)).toBeNull();
  });
});

describe('makeExpTable', () => {
  it('per_level reads the value of the level', () => {
    expect(perLevel.needed(69)).toBe(2000);
    expect(perLevel.needed(72)).toBeNull();
  });
  it('cumulative_start: the value is the total when reaching the level', () => {
    const t = makeExpTable(rows({ 1: 0, 2: 100, 3: 350, 4: 800 }), 'cumulative_start');
    expect(t.needed(1)).toBe(100);
    expect(t.needed(2)).toBe(250);
    expect(t.needed(3)).toBe(450);
    expect(t.needed(4)).toBeNull(); // needs level 5
  });
  it('cumulative_end: the value is the total when completing the level', () => {
    const t = makeExpTable(rows({ 1: 100, 2: 350, 3: 800 }), 'cumulative_end');
    expect(t.needed(2)).toBe(250);
    expect(t.needed(3)).toBe(450);
    expect(t.needed(1)).toBeNull(); // needs level 0
  });
  it('inactive rows are ignored', () => {
    const t = makeExpTable([{ level: 1, value: 10, active: false }, { level: 2, value: 20, active: true }], 'per_level');
    expect(t.needed(1)).toBeNull();
    expect(t.needed(2)).toBe(20);
  });
});

describe('addExp', () => {
  it('stays in the level when the gain does not complete it', () => {
    const r = addExp(perLevel, { level: 69, exp: 1440 }, 200); // 72% + 10%
    expect(r).toEqual({ state: { level: 69, exp: 1640 }, levelsGained: 0, complete: true });
    expect(statePct(perLevel, r.state)).toBe(82);
  });
  it('the example of the brief: level 69 at 72% + a 14% quest = 86%', () => {
    const r = addExp(perLevel, { level: 69, exp: 1440 }, 280);
    expect(statePct(perLevel, r.state)).toBeCloseTo(86, 10);
  });
  it('completes the level and carries the rest into the next, using the EXP of that level', () => {
    // level 69 needs 2000; 1500 + 1000 = 2500 -> level 70 with 500 of 3000 (16.67%)
    const r = addExp(perLevel, { level: 69, exp: 1500 }, 1000);
    expect(r.state).toEqual({ level: 70, exp: 500 });
    expect(r.levelsGained).toBe(1);
    expect(statePct(perLevel, r.state)).toBeCloseTo(16.6667, 3);
  });
  it('crosses several levels', () => {
    // 2000 (to 70) + 3000 (to 71) = 5000, plus 100 left over
    const r = addExp(perLevel, { level: 69, exp: 0 }, 5100);
    expect(r.state).toEqual({ level: 71, exp: 100 });
    expect(r.levelsGained).toBe(2);
  });
  it('exactly the EXP of the level lands on the next level with 0%', () => {
    expect(addExp(perLevel, { level: 69, exp: 1000 }, 1000).state).toEqual({ level: 70, exp: 0 });
  });
  it('does not invent a level the table lacks', () => {
    const r = addExp(perLevel, { level: 71, exp: 0 }, 4000); // completes 71, level 72 is unknown
    expect(r.complete).toBe(false);
    expect(r.missingLevel).toBe(72);
    expect(r.state.level).toBe(72);
  });
  it('overflow "lose" throws away what is above the level-up point', () => {
    expect(addExp(perLevel, { level: 69, exp: 1500 }, 1000, 'lose').state).toEqual({ level: 70, exp: 0 });
    expect(addExp(perLevel, { level: 69, exp: 100 }, 100, 'lose').state).toEqual({ level: 69, exp: 200 });
  });
});

describe('expBetween', () => {
  it('adds the EXP of every level in between', () => {
    expect(expBetween(perLevel, { level: 69, exp: 800 }, { level: 71, exp: 500 })).toBe((2000 - 800) + 3000 + 500);
    expect(expBetween(perLevel, { level: 69, exp: 800 }, { level: 69, exp: 1000 })).toBe(200);
  });
  it('is zero when the goal is behind, null when a level is missing', () => {
    expect(expBetween(perLevel, { level: 70, exp: 0 }, { level: 69, exp: 5 })).toBe(0);
    expect(expBetween(perLevel, { level: 71, exp: 0 }, { level: 73, exp: 0 })).toBeNull();
  });
  it('comparePos orders positions', () => {
    expect(comparePos({ level: 70, exp: 0 }, { level: 69, exp: 1999 })).toBeGreaterThan(0);
    expect(comparePos({ level: 69, exp: 5 }, { level: 69, exp: 6 })).toBeLessThan(0);
  });
});

describe('validateExpRows', () => {
  it('accepts a clean table', () => {
    expect(validateExpRows(rows({ 1: 10, 2: 20, 3: 30 }), 'per_level')).toEqual([]);
  });
  it('reports gaps, duplicates, zeros and bad values', () => {
    const msgs = validateExpRows([...rows({ 1: 10, 3: 30, 4: 0 }), { level: 3, value: 5, active: true }, { level: 5, value: -1, active: true }], 'per_level').map((i) => i.message);
    expect(msgs.some((m) => m.includes('duplicado'))).toBe(true);
    expect(msgs.some((m) => m.includes('faltam os levels'))).toBe(true);
    expect(msgs.some((m) => m.includes('zero'))).toBe(true);
    expect(msgs.some((m) => m.includes('inválido'))).toBe(true);
  });
  it('cumulative values must grow', () => {
    expect(validateExpRows(rows({ 1: 0, 2: 100, 3: 90 }), 'cumulative_start').some((i) => i.message.includes('crescente'))).toBe(true);
  });
});
