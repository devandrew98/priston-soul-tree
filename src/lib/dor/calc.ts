// All numbers of the pain diary come from here, computed from the saved records only (never invented).
// Rules:
//  - a day is 'headache' if any crisis covers it (crises crossing midnight count in every day they touch), 'nopain' only if the
//    person confirmed it, otherwise 'unknown'. An empty day is never "no pain".
//  - simple mean = sum of the recorded intensities / how many were recorded. Missing is never zero.
//  - time-weighted mean = linear interpolation between consecutive recorded points, only between the first and last point
//    (no extrapolation), and only when those points cover at least MIN_COVERAGE of the crisis. Otherwise null (not enough data).
//  - overlapping crises are merged before adding durations; each medication administration is one record, counted once.
import type { AlertRule, Crisis, DayState, Intensity, MedAdmin, NoPain, Rec, Sleep, Therapy } from './types';
import { addDays, dayKey, dayRange, dayStartMs } from './time';

export const MIN_COVERAGE = 0.6;
const ms = (iso: string) => new Date(iso).getTime();

export const crisisStartMs = (c: Crisis) => ms(c.start);
/** End of a crisis; an open one lasts until `now`. */
export const crisisEndMs = (c: Crisis, now: number) => (c.end ? ms(c.end) : Math.max(now, ms(c.start)));

/** Calendar days a crisis touches. */
export function crisisDays(c: Crisis, tz: string, now: number): string[] {
  const end = crisisEndMs(c, now);
  // an end exactly at midnight does not start a new day
  return dayRange(dayKey(ms(c.start), tz), dayKey(Math.max(ms(c.start), end - 1), tz));
}

export interface Interval { s: number; e: number }
/** Total length of the union of intervals (overlaps counted once). */
export function unionMs(list: Interval[]): number {
  const sorted = list.filter((i) => i.e > i.s).sort((a, b) => a.s - b.s);
  let total = 0;
  let cur: Interval | null = null;
  for (const i of sorted) {
    if (!cur || i.s > cur.e) { if (cur) total += cur.e - cur.s; cur = { ...i }; } else cur.e = Math.max(cur.e, i.e);
  }
  return cur ? total + cur.e - cur.s : total;
}

export interface Ctx {
  tz: string; now: number;
  crises: Rec<Crisis>[]; intensities: Rec<Intensity>[]; admins: Rec<MedAdmin>[];
  nopain: Rec<NoPain>[]; sleeps: Rec<Sleep>[]; therapy: Rec<Therapy>[];
}

export function dayStates(ctx: Ctx, days: string[]): Map<string, DayState> {
  const head = new Set<string>();
  for (const c of ctx.crises) for (const d of crisisDays(c.data, ctx.tz, ctx.now)) head.add(d);
  const none = new Set(ctx.nopain.map((n) => n.data.date));
  return new Map(days.map((d) => [d, head.has(d) ? 'headache' : none.has(d) ? 'nopain' : 'unknown']));
}

export interface CrisisStats {
  initial: number | null; last: number | null; max: number | null; simpleMean: number | null;
  /** null = not enough recorded points to estimate honestly */
  timeMean: number | null; timeMeanReason?: 'few_points' | 'low_coverage';
  durationMs: number; admins: number; points: { at: number; value: number }[];
}
export function intensitiesOf(crisis: Rec<Crisis>, all: Rec<Intensity>[]): Rec<Intensity>[] {
  return all.filter((i) => i.data.crisisId === crisis.id).sort((a, b) => ms(a.data.at) - ms(b.data.at));
}
export function adminsOf(crisis: Rec<Crisis>, all: Rec<MedAdmin>[], now: number): Rec<MedAdmin>[] {
  const s = crisisStartMs(crisis.data), e = crisisEndMs(crisis.data, now);
  return all.filter((a) => a.data.status === 'taken' && (a.data.crisisId === crisis.id || (!a.data.crisisId && ms(a.data.at) >= s && ms(a.data.at) <= e)));
}

export function crisisStats(crisis: Rec<Crisis>, intensities: Rec<Intensity>[], admins: Rec<MedAdmin>[], now: number): CrisisStats {
  const pts = intensitiesOf(crisis, intensities).map((i) => ({ at: ms(i.data.at), value: i.data.value }));
  const dur = crisisEndMs(crisis.data, now) - crisisStartMs(crisis.data);
  const out: CrisisStats = {
    initial: pts.length ? pts[0].value : null, last: pts.length ? pts[pts.length - 1].value : null,
    max: pts.length ? Math.max(...pts.map((p) => p.value)) : null,
    simpleMean: pts.length ? pts.reduce((a, p) => a + p.value, 0) / pts.length : null,
    timeMean: null, durationMs: dur, admins: adminsOf(crisis, admins, now).length, points: pts,
  };
  if (pts.length < 2) { out.timeMeanReason = 'few_points'; return out; }
  const span = pts[pts.length - 1].at - pts[0].at;
  if (dur <= 0 || span / dur < MIN_COVERAGE) { out.timeMeanReason = 'low_coverage'; return out; }
  let area = 0;
  for (let i = 1; i < pts.length; i++) area += ((pts[i].value + pts[i - 1].value) / 2) * (pts[i].at - pts[i - 1].at);
  out.timeMean = area / span;
  return out;
}

export interface PeriodStats {
  from: string; to: string; days: number;
  headacheDays: number; nopainDays: number; unknownDays: number; informedDays: number;
  crises: number; frequencyPer30: number | null; avgDurationMs: number | null; totalDurationMs: number;
  meanIntensity: number | null; maxIntensity: number | null;
  reliefDays: number; administrations: number; distinctMeds: number;
  perMed: { name: string; days: number; administrations: number; quantity: number; unit: string }[];
  sleepMean: number | null; sleepQuality: { boa: number; regular: number; ruim: number };
}

/** Everything about the days from `from` to `to` (inclusive). Crises count in the period when they overlap it. */
export function periodStats(ctx: Ctx, from: string, to: string): PeriodStats {
  const days = dayRange(from, to);
  const states = dayStates(ctx, days);
  const sMs = dayStartMs(from, ctx.tz), eMs = dayStartMs(addDays(to, 1), ctx.tz);
  const crises = ctx.crises.filter((c) => crisisStartMs(c.data) < eMs && crisisEndMs(c.data, ctx.now) > sMs);
  const clip = crises.map((c) => ({ s: Math.max(crisisStartMs(c.data), sMs), e: Math.min(crisisEndMs(c.data, ctx.now), eMs) }));
  const total = unionMs(clip);
  const ints = ctx.intensities.filter((i) => { const t = ms(i.data.at); return t >= sMs && t < eMs; });
  const taken = ctx.admins.filter((a) => { const t = ms(a.data.at); return a.data.status === 'taken' && t >= sMs && t < eMs; });
  const relief = taken.filter((a) => a.data.category === 'crisis');
  const reliefDays = new Set(relief.map((a) => dayKey(ms(a.data.at), ctx.tz)));
  const byMed = new Map<string, { name: string; unit: string; days: Set<string>; n: number; q: number }>();
  for (const a of relief) {
    const key = a.data.medId;
    const m = byMed.get(key) ?? { name: a.data.name, unit: a.data.unit, days: new Set<string>(), n: 0, q: 0 };
    m.days.add(dayKey(ms(a.data.at), ctx.tz)); m.n++; m.q += a.data.quantity;
    byMed.set(key, m);
  }
  const sl = ctx.sleeps.filter((s) => s.data.date >= from && s.data.date <= to);
  const hours = sl.filter((s) => typeof s.data.hours === 'number').map((s) => s.data.hours as number);
  const count = (st: DayState) => [...states.values()].filter((v) => v === st).length;
  const q = { boa: 0, regular: 0, ruim: 0 };
  for (const s of sl) if (s.data.quality) q[s.data.quality]++;
  const headacheDays = count('headache');
  return {
    from, to, days: days.length, headacheDays, nopainDays: count('nopain'), unknownDays: count('unknown'), informedDays: headacheDays + count('nopain'),
    crises: crises.length, frequencyPer30: days.length ? (crises.length / days.length) * 30 : null,
    avgDurationMs: crises.length ? total / crises.length : null, totalDurationMs: total,
    meanIntensity: ints.length ? ints.reduce((a, i) => a + i.data.value, 0) / ints.length : null,
    maxIntensity: ints.length ? Math.max(...ints.map((i) => i.data.value)) : null,
    reliefDays: reliefDays.size, administrations: relief.length, distinctMeds: byMed.size,
    perMed: [...byMed.values()].map((m) => ({ name: m.name, days: m.days.size, administrations: m.n, quantity: m.q, unit: m.unit })).sort((a, b) => b.administrations - a.administrations),
    sleepMean: hours.length ? hours.reduce((a, h) => a + h, 0) / hours.length : null, sleepQuality: q,
  };
}

/** Same-length windows right before and right after a date (the date itself belongs to "after"). */
export function compareAround(ctx: Ctx, date: string, windowDays: number): { before: PeriodStats; after: PeriodStats } {
  return {
    before: periodStats(ctx, addDays(date, -windowDays), addDays(date, -1)),
    after: periodStats(ctx, date, addDays(date, windowDays - 1)),
  };
}

/** Informative notices from the rules the doctor configured. With no rules there are none. */
export function alertsFor(ctx: Ctx, rules: Rec<AlertRule>[], today: string): { rule: Rec<AlertRule>; days: number }[] {
  const out: { rule: Rec<AlertRule>; days: number }[] = [];
  for (const r of rules) {
    if (!r.data.active) continue;
    const from = addDays(today, -(r.data.windowDays - 1));
    const used = new Set<string>();
    for (const a of ctx.admins) {
      if (a.data.status !== 'taken' || a.data.category !== 'crisis') continue;
      if (r.data.scope === 'med' && a.data.medId !== r.data.medId) continue;
      const d = dayKey(ms(a.data.at), ctx.tz);
      if (d >= from && d <= today) used.add(d);
    }
    if (used.size >= r.data.maxDays) out.push({ rule: r, days: used.size });
  }
  return out;
}

/** Highest recorded intensity of each day (for the calendar colours). */
export function dayPeaks(ctx: Ctx): Map<string, number> {
  const peaks = new Map<string, number>();
  for (const i of ctx.intensities) {
    const d = dayKey(ms(i.data.at), ctx.tz);
    peaks.set(d, Math.max(peaks.get(d) ?? 0, i.data.value));
  }
  return peaks;
}
