// Dates of the pain diary. Every record keeps an exact instant (ISO, UTC); the calendar day it belongs to is
// worked out in the diary's time zone (America/Sao_Paulo unless changed in the settings).
export const DEFAULT_TZ = 'America/Sao_Paulo';

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function parts(ms: number, tz: string): Record<string, string> {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  return Object.fromEntries(f.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
}

/** 'YYYY-MM-DD' of an instant in the diary's time zone. */
export function dayKey(ms: number, tz = DEFAULT_TZ): string {
  const p = parts(ms, tz);
  return `${p.year}-${p.month}-${p.day}`;
}
/** 'HH:MM' (24 h) of an instant in the diary's time zone. */
export function timeKey(ms: number, tz = DEFAULT_TZ): string {
  const p = parts(ms, tz);
  return `${p.hour}:${p.minute}`;
}
function offsetMs(ms: number, tz: string): number {
  const p = parts(ms, tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}
/** The instant of a wall-clock date + time in the time zone. */
export function localToMs(date: string, time: string, tz = DEFAULT_TZ): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  let ms = asUtc - offsetMs(asUtc, tz);
  ms = asUtc - offsetMs(ms, tz); // second pass settles the zones that change offset
  return ms;
}
export const dayStartMs = (key: string, tz = DEFAULT_TZ) => localToMs(key, '00:00', tz);

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  const f = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((f(b) - f(a)) / 86400000);
}
/** Every day from `from` to `to`, both included. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to && out.length < 4000; k = addDays(k, 1)) out.push(k);
  return out;
}

/** '28/10/2026' */
export const fmtDate = (key: string) => (key ? key.split('-').reverse().join('/') : '');
/** '28/10/2026 14:05' */
export const fmtDateTime = (ms: number, tz = DEFAULT_TZ) => `${fmtDate(dayKey(ms, tz))} ${timeKey(ms, tz)}`;
/** '2 h 05 min' / '35 min' */
export function fmtDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}
