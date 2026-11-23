import { describe, expect, it } from 'vitest';
import { flakeCount, isChristmasSeason } from './christmas';

describe('Christmas season', () => {
  it('runs from 15 November to 6 January', () => {
    expect(isChristmasSeason(new Date(2026, 10, 14))).toBe(false);
    expect(isChristmasSeason(new Date(2026, 10, 15))).toBe(true);
    expect(isChristmasSeason(new Date(2026, 10, 23))).toBe(true);
    expect(isChristmasSeason(new Date(2026, 11, 25))).toBe(true);
    expect(isChristmasSeason(new Date(2027, 0, 6))).toBe(true);
    expect(isChristmasSeason(new Date(2027, 0, 7))).toBe(false);
    expect(isChristmasSeason(new Date(2026, 5, 10))).toBe(false);
  });
  it('snowflake count stays small and grows with the screen', () => {
    expect(flakeCount(360, 640)).toBeGreaterThanOrEqual(18);
    expect(flakeCount(360, 640)).toBeLessThan(flakeCount(1920, 1080));
    expect(flakeCount(3840, 2160)).toBeLessThanOrEqual(60);
  });
});
