// Priston Tale EU boss spawn schedule.
// The schedule is anchored to the game's OFFICIAL time = GMT 0 (UTC). Spawns are
// fixed absolute moments; every visitor sees the same countdown, only the displayed
// wall-clock time is localised to their timezone. CHAOS QUEEN removed on request.

export interface Boss {
  id: string;
  name: string; // proper noun — same in PT/EN
  location: string;
  level: number | null;
  img: string;
  tone: string; // accent color used for the 3D glow behind the (transparent) portrait
}

export const BOSSES: Record<string, Boss> = {
  valento: { id: 'valento', name: 'Valento', location: 'Frozen Sanctuary', level: 92, img: '/bosses/valento.png', tone: '#5aa9e6' },
  kelvezu: { id: 'kelvezu', name: 'Kelvezu', location: 'Kelvezu Cave', level: 92, img: '/bosses/kelvezu.png', tone: '#9b6bd6' },
  gorgoniac: { id: 'gorgoniac', name: 'Gorgoniac', location: 'Endless Tower #1', level: 100, img: '/bosses/gorgoniac.png', tone: '#6fbf73' },
  draxos: { id: 'draxos', name: 'Draxos', location: 'Secret Lab', level: 108, img: '/bosses/draxos.png', tone: '#3fb6a8' },
  eadric: { id: 'eadric', name: 'Eadric / Vault', location: 'Vaults of Ricarten', level: null, img: '/bosses/eadric.png', tone: '#e6c25a' },
  dayane: { id: 'dayane', name: 'Dayane', location: 'Whispering Vale', level: null, img: '/bosses/dayane.png', tone: '#e46ea9' },
  'bloody-king': { id: 'bloody-king', name: 'Blood Prince', location: 'Land of Chaos', level: 95, img: '/bosses/bloody-king.png', tone: '#e05252' },
  'devil-shy': { id: 'devil-shy', name: 'Devil Shy', location: 'Endless Tower #2', level: 102, img: '/bosses/devil-shy.png', tone: '#b452d9' },
  'primal-golem': { id: 'primal-golem', name: 'Primal Golem', location: 'Forge of the Ancients', level: 115, img: '/bosses/primal-golem.png', tone: '#e2953b' },
  deius: { id: 'deius', name: 'Deius', location: 'Land of Neuren', level: 120, img: '/bosses/deius.png', tone: '#5ad6d0' },
  mokova: { id: 'mokova', name: 'Mokova', location: 'Lost Temple', level: 98, img: '/bosses/mokova.png', tone: '#7fae4f' },
  tulla: { id: 'tulla', name: 'Tulla', location: 'Ice Mine', level: 105, img: '/bosses/tulla.png', tone: '#6fc3e6' },
  greedy: { id: 'greedy', name: 'Greedy', location: 'Ancient Weapon', level: 110, img: '/bosses/greedy.png', tone: '#e6b93b' },
  aragonian: { id: 'aragonian', name: 'Aragonian', location: 'Cave Crystal Nest', level: 118, img: '/bosses/aragonian.png', tone: '#c060d9' },
  yagditha: { id: 'yagditha', name: 'Yagditha', location: 'Abyss of the Sea', level: 113, img: '/bosses/yagditha.png', tone: '#4f7fd6' },
  ignis: { id: 'ignis', name: 'Ignis', location: 'Heart of Fire', level: 113, img: '/bosses/ignis.png', tone: '#e0663b' },
};

export const ALL_BOSSES: Boss[] = Object.values(BOSSES);

// Official schedule in GMT 0 (game time). Primal Golem at 10:30 & 22:30 is Hard mode "(H)".
const RAW: [string, string[]][] = [
  ['00:30', ['kelvezu', 'gorgoniac', 'devil-shy', 'greedy', 'aragonian', 'eadric']],
  ['01:30', ['valento', 'bloody-king', 'yagditha', 'tulla']],
  ['02:00', ['deius']],
  ['02:30', ['mokova', 'ignis']],
  ['03:30', ['valento', 'kelvezu', 'gorgoniac', 'draxos', 'eadric', 'dayane']],
  ['04:00', ['deius']],
  ['04:30', ['bloody-king', 'devil-shy', 'primal-golem']],
  ['05:30', ['valento', 'mokova', 'tulla']],
  ['06:00', ['deius']],
  ['06:30', ['kelvezu', 'gorgoniac', 'greedy', 'aragonian', 'eadric']],
  ['07:30', ['valento', 'bloody-king', 'draxos', 'yagditha']],
  ['08:00', ['deius']],
  ['08:30', ['mokova', 'devil-shy', 'ignis']],
  ['09:30', ['valento', 'kelvezu', 'gorgoniac', 'tulla', 'eadric', 'dayane']],
  ['10:00', ['deius']],
  ['10:30', ['bloody-king', 'primal-golem']], // Primal Golem (H)
  ['11:30', ['valento', 'mokova', 'draxos']],
  ['12:00', ['deius']],
  ['12:30', ['kelvezu', 'gorgoniac', 'devil-shy', 'greedy', 'aragonian', 'eadric']],
  ['13:30', ['valento', 'bloody-king', 'yagditha', 'tulla']],
  ['14:00', ['deius']],
  ['14:30', ['mokova', 'ignis']],
  ['15:30', ['valento', 'kelvezu', 'gorgoniac', 'draxos', 'eadric', 'dayane']],
  ['16:00', ['deius']],
  ['16:30', ['bloody-king', 'devil-shy', 'primal-golem']],
  ['17:30', ['valento', 'mokova', 'tulla']],
  ['18:00', ['deius']],
  ['18:30', ['kelvezu', 'gorgoniac', 'greedy', 'aragonian', 'eadric']],
  ['19:30', ['valento', 'bloody-king', 'draxos', 'yagditha']],
  ['20:00', ['deius']],
  ['20:30', ['mokova', 'devil-shy', 'ignis']],
  ['21:30', ['valento', 'kelvezu', 'gorgoniac', 'tulla', 'eadric', 'dayane']],
  ['22:00', ['deius']],
  ['22:30', ['bloody-king', 'primal-golem']], // Primal Golem (H)
  ['23:30', ['valento', 'mokova', 'draxos']],
];

const HARD_PRIMAL_TIMES = new Set(['10:30', '22:30']);

export interface ScheduleEntry {
  hm: string; // "HH:MM" in GMT 0 (internal reference)
  utcMin: number; // minutes past UTC midnight
  ids: string[];
  hardPrimal: boolean; // Primal Golem here is Hard mode
}

const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

export const SCHEDULE: ScheduleEntry[] = RAW.map(([hm, ids]) => ({
  hm,
  utcMin: toMin(hm),
  ids,
  hardPrimal: HARD_PRIMAL_TIMES.has(hm),
}));

const DAY_MS = 86400000;

/** The next absolute occurrence (>= now) of a UTC time-of-day. */
export function nextOccurrence(utcMin: number, now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(Math.floor(utcMin / 60), utcMin % 60, 0, 0);
  if (d.getTime() <= now.getTime()) d.setTime(d.getTime() + DAY_MS);
  return d;
}

export interface BossEvent {
  entry: ScheduleEntry;
  ids: string[]; // bosses at this spawn (already filtered)
  when: Date; // absolute moment of the relevant occurrence
  state: 'spawned' | 'upcoming';
  sec: number; // seconds since spawn (spawned) or until spawn (upcoming)
}

// A boss stays visible as "just spawned" for this long after its spawn moment.
export const RECENT_SEC = 180;

/** Build the ordered event list: just-spawned first (newest), then upcoming (soonest). */
export function buildEvents(now: Date, favorites?: Set<string>): BossEvent[] {
  const out: BossEvent[] = [];
  for (const entry of SCHEDULE) {
    let ids = entry.ids;
    if (favorites && favorites.size) {
      ids = ids.filter((id) => favorites.has(id));
      if (!ids.length) continue;
    }
    const next = nextOccurrence(entry.utcMin, now);
    const last = new Date(next.getTime() - DAY_MS);
    const untilNext = Math.round((next.getTime() - now.getTime()) / 1000);
    const sinceLast = Math.round((now.getTime() - last.getTime()) / 1000);
    if (sinceLast >= 0 && sinceLast <= RECENT_SEC) {
      out.push({ entry, ids, when: last, state: 'spawned', sec: sinceLast });
    } else {
      out.push({ entry, ids, when: next, state: 'upcoming', sec: untilNext });
    }
  }
  out.sort((a, b) => (a.state !== b.state ? (a.state === 'spawned' ? -1 : 1) : a.sec - b.sec));
  return out;
}

/** The soonest upcoming spawn for one boss. */
export function nextForBoss(bossId: string, now: Date): { when: Date; sec: number } | null {
  let best: { when: Date; sec: number } | null = null;
  for (const e of SCHEDULE) {
    if (!e.ids.includes(bossId)) continue;
    const next = nextOccurrence(e.utcMin, now);
    const sec = Math.round((next.getTime() - now.getTime()) / 1000);
    if (!best || sec < best.sec) best = { when: next, sec };
  }
  return best;
}

// ---- formatting ----
const pad = (n: number) => String(n).padStart(2, '0');

/** "03h 08m" / "9m 19s" / "45s" — only the time remaining, no wall clock. */
export function fmtCountdown(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${pad(h)}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(ss)}s`;
  return `${ss}s`;
}

/** "2m 05s" / "40s" — elapsed since spawn. */
export function fmtSince(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m > 0 ? `${m}m ${pad(ss)}s` : `${ss}s`;
}

// ---- timezone ----
export function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Resolve a UI choice ('auto' | 'UTC' | IANA id) to a real IANA timezone. */
export function resolveTz(choice: string): string {
  return choice === 'auto' ? detectTz() : choice;
}

/** "HH:MM" for a date in a timezone. */
export function localTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

/** "HH:MM:SS" clock for a date in a timezone. */
export function localClock(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/** Minutes-of-day for a date in a timezone (for sorting the schedule locally). */
export function localMinutes(date: Date, tz: string): number {
  const [h, m] = localTime(date, tz).split(':').map(Number);
  return h * 60 + m;
}

/** Short offset label like "GMT-3" for a timezone. */
export function tzOffsetLabel(tz: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName');
    return part?.value || '';
  } catch {
    return '';
  }
}

export interface TzOption {
  id: string;
  pt: string;
  en: string;
}

export const TZ_OPTIONS: TzOption[] = [
  { id: 'auto', pt: 'Automático (seu fuso)', en: 'Automatic (your timezone)' },
  { id: 'UTC', pt: 'Horário do jogo (GMT 0)', en: 'Game time (GMT 0)' },
  { id: 'America/Sao_Paulo', pt: 'Brasília (GMT-3)', en: 'Brasília (GMT-3)' },
  { id: 'Europe/London', pt: 'Londres', en: 'London' },
  { id: 'Europe/Lisbon', pt: 'Lisboa', en: 'Lisbon' },
  { id: 'Europe/Madrid', pt: 'Madri', en: 'Madrid' },
  { id: 'Europe/Berlin', pt: 'Berlim / Paris', en: 'Berlin / Paris' },
  { id: 'America/New_York', pt: 'Nova York (EUA Leste)', en: 'New York (US East)' },
  { id: 'America/Los_Angeles', pt: 'Los Angeles (EUA Oeste)', en: 'Los Angeles (US West)' },
  { id: 'America/Mexico_City', pt: 'Cidade do México', en: 'Mexico City' },
  { id: 'America/Argentina/Buenos_Aires', pt: 'Buenos Aires', en: 'Buenos Aires' },
];
