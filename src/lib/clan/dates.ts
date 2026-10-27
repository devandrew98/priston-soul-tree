// Dates of the Bless Castle: the <input type="datetime-local"> value <-> an ISO instant, and how a date is shown to the players.
// The date is stored as an instant, so every player sees it in their own time zone.

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant -> the value of a datetime-local input (local time), or '' when empty/invalid. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (local time) -> ISO instant, or null when empty/invalid. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type Lang = 'pt' | 'en';
const locale = (lang: Lang) => (lang === 'pt' ? 'pt-BR' : 'en-US');

/** "sábado, 25 de outubro às 21:00" */
export function formatBc(ms: number, lang: Lang): string {
  return new Date(ms).toLocaleString(locale(lang), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/** "25/10/26 21:00", for the attendance lists. */
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
  const days = Math.floor((now - ms) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  if (days < 1) return rtf.format(0, 'day');
  if (days < 31) return rtf.format(-days, 'day');
  return rtf.format(-Math.floor(days / 30), 'month');
}
