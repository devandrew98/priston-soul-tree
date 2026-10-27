import { describe, expect, it } from 'vitest';
import { countdown, fromLocalInput, relativeDays, toLocalInput } from './dates';

describe('datetime-local conversion', () => {
  it('round-trips a local date and time', () => {
    const iso = fromLocalInput('2026-11-07T21:30')!;
    expect(new Date(iso).getHours()).toBe(21);
    expect(toLocalInput(iso)).toBe('2026-11-07T21:30');
  });
  it('empty or invalid values are empty', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('nope')).toBeNull();
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('nope')).toBe('');
  });
});

describe('countdown', () => {
  const now = 1_000_000_000_000;
  it('shows days, hours or minutes', () => {
    expect(countdown(now + (2 * 1440 + 3 * 60 + 5) * 60_000, now)).toBe('2d 3h');
    expect(countdown(now + (3 * 60 + 20) * 60_000, now)).toBe('3h 20min');
    expect(countdown(now + 15 * 60_000, now)).toBe('15min');
    expect(countdown(now + 5_000, now)).toBe('1min');
  });
  it('is null once the time has passed', () => {
    expect(countdown(now - 1, now)).toBeNull();
    expect(countdown(now, now)).toBeNull();
  });
});

describe('relativeDays', () => {
  const now = Date.UTC(2026, 10, 10, 12);
  it('says today, days and months', () => {
    expect(relativeDays(now - 3_600_000, now, 'pt')).toBe('hoje');
    expect(relativeDays(now - 3 * 86_400_000, now, 'pt')).toMatch(/3 dias/);
    expect(relativeDays(now - 70 * 86_400_000, now, 'pt')).toMatch(/2 meses/);
  });
});
