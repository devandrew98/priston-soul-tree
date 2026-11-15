import { describe, expect, it } from 'vitest';
import { SEASON_LAUNCH_AT, remaining } from './countdown';

describe('season countdown', () => {
  it('launches on 27 November 2026 at 15:00 Brasília time (18:00 UTC)', () => {
    expect(new Date(SEASON_LAUNCH_AT).toISOString()).toBe('2026-11-27T18:00:00.000Z');
  });
  it('splits the time left into days, hours, minutes and seconds', () => {
    const t = SEASON_LAUNCH_AT;
    expect(remaining(t - (12 * 86400 + 3 * 3600 + 5 * 60 + 9) * 1000)).toEqual({ days: 12, hours: 3, minutes: 5, seconds: 9, done: false });
    expect(remaining(t - 1000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1, done: false });
    expect(remaining(t - 86400 * 1000)).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0, done: false });
  });
  it('is done at the launch moment and after it, never negative', () => {
    expect(remaining(SEASON_LAUNCH_AT)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
    expect(remaining(SEASON_LAUNCH_AT + 5 * 86400 * 1000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });
  it('rounds a partial second down, so it never shows 0 before the moment', () => {
    expect(remaining(SEASON_LAUNCH_AT - 500)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: false });
  });
});
