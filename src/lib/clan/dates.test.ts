import { describe, expect, it } from 'vitest';
import { bcSaturdays, countdown, formatBc, relativeDays } from './dates';

// Brasília is UTC-3, so Saturday 12:00 there is 15:00 UTC.
const sat = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 15);

describe('bcSaturdays', () => {
  it('on a weekday the next BC is the coming Saturday noon and the last is the one before', () => {
    const wed = Date.UTC(2026, 10, 4, 18); // Wed 4 Nov 2026, 15:00 in Brasília
    expect(bcSaturdays(wed)).toEqual({ last: sat(2026, 10, 31), next: sat(2026, 11, 7) });
  });
  it('on Saturday before noon the BC of the day is still the next one', () => {
    const satMorning = Date.UTC(2026, 10, 7, 14, 59); // 11:59 in Brasília
    expect(bcSaturdays(satMorning)).toEqual({ last: sat(2026, 10, 31), next: sat(2026, 11, 7) });
  });
  it('from Saturday noon on, the BC of the day is the last one and the next is a week later', () => {
    expect(bcSaturdays(sat(2026, 11, 7))).toEqual({ last: sat(2026, 11, 7), next: sat(2026, 11, 14) });
    expect(bcSaturdays(Date.UTC(2026, 10, 8, 2))).toEqual({ last: sat(2026, 11, 7), next: sat(2026, 11, 14) });
  });
  it('uses Brasília time: Saturday evening UTC after Brasília midnight is already Sunday there', () => {
    const sunEarlyBr = Date.UTC(2026, 10, 8, 4); // Sun 01:00 in Brasília, still Sat in UTC+0? no: 04:00 UTC
    expect(bcSaturdays(sunEarlyBr).last).toBe(sat(2026, 11, 7));
  });
  it('is always a Saturday at 12:00 in Brasília and a week apart', () => {
    for (let i = 0; i < 400; i++) {
      const { last, next } = bcSaturdays(Date.UTC(2026, 0, 1) + i * 37 * 3_600_000);
      expect(next - last).toBe(7 * 86_400_000);
      const br = new Date(next - 3 * 3_600_000);
      expect([br.getUTCDay(), br.getUTCHours(), br.getUTCMinutes()]).toEqual([6, 12, 0]);
    }
  });
});

describe('formatBc', () => {
  it('capitalizes the weekday and the month', () => {
    const text = formatBc(Date.UTC(2026, 9, 31, 15), 'pt'); // Sat 31 Oct 2026, 12:00 in Brasília
    expect(text).toMatch(/^[A-ZÁÉÍÓÚÃÕÇ]/);
    expect(text).toContain('Outubro');
    expect(text).toContain('de Outubro');
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
