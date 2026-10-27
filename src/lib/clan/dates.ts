// Dates of the Bless Castle. The BC is always on Saturday at noon, Brasília time (America/Sao_Paulo, UTC-3 all year since 2019),
// so nobody has to type the date: the next one is worked out from today. Dates are instants, so every player sees them in
// their own time zone.

const BR_OFFSET_MS = -3 * 3_600_000;
const DAY_MS = 86_400_000;

/** The BC that already started (`last`, the most recent Saturday noon) and the next one (`next`), as instants in ms. */
export function bcSaturdays(now: number): { last: number; next: number } {
  const br = new Date(now + BR_OFFSET_MS); // Brasília wall-clock, read with the UTC getters
  const daysSinceSaturday = (br.getUTCDay() + 1) % 7; // Sat 0, Sun 1, ... Fri 6
  const thisSaturdayNoon = Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() - daysSinceSaturday, 12) - BR_OFFSET_MS;
  return thisSaturdayNoon <= now
    ? { last: thisSaturdayNoon, next: thisSaturdayNoon + 7 * DAY_MS }
    : { last: thisSaturdayNoon - 7 * DAY_MS, next: thisSaturdayNoon }; // Saturday before noon
}

type Lang = 'pt' | 'en';
const locale = (lang: Lang) => (lang === 'pt' ? 'pt-BR' : 'en-US');

/** "Sábado, 25 de Outubro às 12:00": the weekday and the month start with a capital letter. */
export function formatBc(ms: number, lang: Lang): string {
  const parts = new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms));
  return parts.map((p) => (p.type === 'weekday' || p.type === 'month' ? p.value.charAt(0).toUpperCase() + p.value.slice(1) : p.value)).join('');
}

/** "25/10/26 12:00", for the attendance lists. */
export function formatShort(ms: number, lang: Lang): string {
  return new Date(ms).toLocaleString(locale(lang), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** "2d 3h", "3h 20min", "15min" until `ms`; null when it is already past. */
export function countdown(ms: number, now: number): string | null {
  const diff = ms - now;
  if (diff <= 0) return null;
  const min = Math.floor(diff / 60_000);
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${Math.max(1, m)}min`;
}

/** "hoje", "há 3 dias", "há 2 meses" for the administrator's overview. */
export function relativeDays(ms: number, now: number, lang: Lang): string {
  const days = Math.floor((now - ms) / DAY_MS);
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  if (days < 1) return rtf.format(0, 'day');
  if (days < 31) return rtf.format(-days, 'day');
  return rtf.format(-Math.floor(days / 30), 'month');
}
