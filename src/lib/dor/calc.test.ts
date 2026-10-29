import { describe, expect, it } from 'vitest';
import { alertsFor, compareAround, crisisDays, crisisStats, dayStates, periodStats, unionMs, type Ctx } from './calc';
import { dayKey, dayStartMs, localToMs, timeKey } from './time';
import type { AlertRule, Crisis, Intensity, MedAdmin, Rec } from './types';

const TZ = 'America/Sao_Paulo';
const at = (date: string, time: string) => new Date(localToMs(date, time, TZ)).toISOString();
let n = 0;
const rec = <T extends object>(kind: Rec['kind'], data: T): Rec<T> => ({ id: `r${++n}`, kind, data, eventAt: null, version: 1, createdAt: '', updatedAt: '', deletedAt: null }) as Rec<T>;
const crisis = (s: [string, string], e?: [string, string]) => rec<Crisis>('crisis', { start: at(...s), end: e && at(...e), location: [], character: [], symptoms: [], factors: [] });
const inten = (c: Rec<Crisis>, date: string, time: string, value: number) => rec<Intensity>('intensity', { crisisId: c.id, at: at(date, time), value });
const admin = (name: string, date: string, time: string, category: 'crisis' | 'continuous' = 'crisis', crisisId?: string, status: 'taken' | 'omitted' = 'taken') =>
  rec<MedAdmin>('med_admin', { medId: name, name, dose: '1', unit: 'g', category, quantity: 1, at: at(date, time), crisisId, status });
const ctx = (p: Partial<Ctx> = {}): Ctx => ({ tz: TZ, now: localToMs('2026-10-28', '12:00', TZ), crises: [], intensities: [], admins: [], nopain: [], sleeps: [], therapy: [], physio: [], ...p });

describe('time', () => {
  it('converts wall-clock time in São Paulo both ways', () => {
    const t = localToMs('2026-10-28', '23:30', TZ);
    expect(dayKey(t, TZ)).toBe('2026-10-28');
    expect(timeKey(t, TZ)).toBe('23:30');
    expect(dayKey(t + 31 * 60000, TZ)).toBe('2026-10-29');
    expect(dayStartMs('2026-10-28', TZ)).toBe(localToMs('2026-10-28', '00:00', TZ));
  });
});

describe('days with headache', () => {
  it('a crisis crossing midnight counts in both days', () => {
    const c = crisis(['2026-10-26', '22:00'], ['2026-10-27', '03:00']);
    expect(crisisDays(c.data, TZ, 0)).toEqual(['2026-10-26', '2026-10-27']);
  });
  it('an end exactly at midnight does not add a day', () => {
    const c = crisis(['2026-10-26', '22:00'], ['2026-10-27', '00:00']);
    expect(crisisDays(c.data, TZ, 0)).toEqual(['2026-10-26']);
  });
  it('empty days are unknown, confirmed ones are nopain, and a crisis beats a confirmation', () => {
    const c = crisis(['2026-10-26', '10:00'], ['2026-10-26', '12:00']);
    const nopain = [rec('nopain', { date: '2026-10-25' }), rec('nopain', { date: '2026-10-26' })];
    const st = dayStates(ctx({ crises: [c], nopain: nopain as never }), ['2026-10-24', '2026-10-25', '2026-10-26']);
    expect([...st.values()]).toEqual(['unknown', 'nopain', 'headache']);
  });
});

describe('overlapping crises', () => {
  it('merge before summing the duration', () => {
    expect(unionMs([{ s: 0, e: 10 }, { s: 5, e: 20 }, { s: 30, e: 40 }])).toBe(30);
  });
  it('two crises in one day are two crises but one headache day', () => {
    const a = crisis(['2026-10-20', '08:00'], ['2026-10-20', '10:00']);
    const b = crisis(['2026-10-20', '18:00'], ['2026-10-20', '19:00']);
    const p = periodStats(ctx({ crises: [a, b] }), '2026-10-20', '2026-10-22');
    expect(p.crises).toBe(2);
    expect(p.headacheDays).toBe(1);
    expect(p.unknownDays).toBe(2);
    expect(p.totalDurationMs).toBe(3 * 3600000);
  });
});

describe('crisis statistics', () => {
  const c = crisis(['2026-10-20', '10:00'], ['2026-10-20', '14:00']);
  it('simple mean ignores what was not recorded', () => {
    const s = crisisStats(c, [inten(c, '2026-10-20', '10:00', 8), inten(c, '2026-10-20', '12:00', 4)], [], 0);
    expect([s.initial, s.last, s.max, s.simpleMean]).toEqual([8, 4, 8, 6]);
  });
  it('time mean interpolates between the points', () => {
    // 8 -> 4 over 2 h = average 6; 4 -> 4 over 2 h = 4; (6*2 + 4*2) / 4 = 5
    const s = crisisStats(c, [inten(c, '2026-10-20', '10:00', 8), inten(c, '2026-10-20', '12:00', 4), inten(c, '2026-10-20', '14:00', 4)], [], 0);
    expect(s.timeMean).toBeCloseTo(5, 5);
  });
  it('refuses to estimate with one point or with points covering too little', () => {
    expect(crisisStats(c, [inten(c, '2026-10-20', '10:00', 8)], [], 0).timeMean).toBeNull();
    const few = crisisStats(c, [inten(c, '2026-10-20', '10:00', 8), inten(c, '2026-10-20', '10:30', 2)], [], 0);
    expect(few.timeMean).toBeNull();
    expect(few.timeMeanReason).toBe('low_coverage');
  });
  it('no intensity at all gives no numbers (never zero)', () => {
    const s = crisisStats(c, [], [], 0);
    expect([s.initial, s.max, s.simpleMean, s.timeMean]).toEqual([null, null, null, null]);
  });
});

describe('medication usage', () => {
  const c = crisis(['2026-10-20', '10:00'], ['2026-10-20', '14:00']);
  const list = [
    admin('Dipirona', '2026-10-20', '10:30', 'crisis', c.id), admin('Dipirona', '2026-10-20', '16:00'), admin('Dorflex', '2026-10-20', '18:00'),
    admin('Dipirona', '2026-10-21', '09:00'), admin('Amitriptilina', '2026-10-20', '22:00', 'continuous'), admin('Dorflex', '2026-10-22', '09:00', 'crisis', undefined, 'omitted'),
  ];
  const p = periodStats(ctx({ crises: [c], admins: list }), '2026-10-20', '2026-10-22');
  it('counts administrations but days only once, and keeps continuous apart', () => {
    expect(p.administrations).toBe(4);
    expect(p.reliefDays).toBe(2);
    expect(p.distinctMeds).toBe(2);
    expect(p.perMed.find((m) => m.name === 'Dipirona')).toMatchObject({ days: 2, administrations: 3 });
  });
  it('an omitted dose is not an administration', () => {
    expect(p.perMed.find((m) => m.name === 'Dorflex')?.administrations).toBe(1);
  });
  it('an administration linked to the crisis is counted once for it', () => {
    expect(crisisStats(c, [], list, 0).admins).toBe(1);
  });
});

describe('comparison and alerts', () => {
  it('compares equal windows before and after a date', () => {
    const a = crisis(['2026-10-05', '10:00'], ['2026-10-05', '11:00']);
    const { before, after } = compareAround(ctx({ crises: [a] }), '2026-10-10', 7);
    expect([before.days, after.days, before.crises, after.crises]).toEqual([7, 7, 1, 0]);
  });
  it('there are no alerts without rules, and a rule fires at its own threshold', () => {
    const list = [admin('Dipirona', '2026-10-26', '09:00'), admin('Dipirona', '2026-10-27', '09:00'), admin('Dipirona', '2026-10-27', '20:00')];
    expect(alertsFor(ctx({ admins: list }), [], '2026-10-28')).toEqual([]);
    const rule = rec<AlertRule>('alert_rule', { name: 'x', active: true, scope: 'any_crisis_med', windowDays: 7, maxDays: 2 });
    expect(alertsFor(ctx({ admins: list }), [rule], '2026-10-28')[0].days).toBe(2);
    expect(alertsFor(ctx({ admins: list }), [{ ...rule, data: { ...rule.data, maxDays: 3 } }], '2026-10-28')).toEqual([]);
  });
});
