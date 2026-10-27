import { describe, expect, it } from 'vitest';
import { AGE_CHANCES, EFFICIENCY_STEP, failChance } from './chances';

describe('aging chances', () => {
  it('has the 22 levels of the official table', () => {
    expect(AGE_CHANCES).toHaveLength(22);
    expect(AGE_CHANCES.map((c) => c.level)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
  });
  it('matches the table at the edges and in the middle', () => {
    expect(AGE_CHANCES[0]).toEqual({ level: 1, success: 100, double: 18, breakPct: 0 });
    expect(AGE_CHANCES[8]).toEqual({ level: 9, success: 58, double: 10, breakPct: 8 });
    expect(AGE_CHANCES[13]).toEqual({ level: 14, success: 29, double: 5, breakPct: 18 });
    expect(AGE_CHANCES[21]).toEqual({ level: 22, success: 5, double: 0, breakPct: 35 });
  });
  it('items up to +8 never break', () => {
    expect(AGE_CHANCES.slice(0, 8).every((c) => c.breakPct === 0)).toBe(true);
    expect(AGE_CHANCES.slice(8).every((c) => c.breakPct > 0)).toBe(true);
  });
  it('failure is 100 minus success, and the efficiency step is 2 points', () => {
    expect(failChance(AGE_CHANCES[21])).toBe(95);
    expect(failChance(AGE_CHANCES[0])).toBe(0);
    expect(EFFICIENCY_STEP).toBe(2);
  });
});

describe('aging efficiency', () => {
  it('adds 2 points of success per failure in a row and caps at 100', async () => {
    const { effectiveSuccess } = await import('./chances');
    expect(effectiveSuccess(5, 0)).toBe(5);
    expect(effectiveSuccess(5, 3)).toBe(11);
    expect(effectiveSuccess(58, 30)).toBe(100);
    expect(effectiveSuccess(58, -4)).toBe(58);
  });
});
