// Priston Tale EU boss spawn schedule (official Brasília time, GMT-3).
// Times come from the in-game schedule the user provided. CHAOS QUEEN removed on request.

export interface Boss {
  id: string;
  name: string; // proper noun — same in PT/EN
  location: string;
  level: number | null;
  img: string;
}

export const BOSSES: Record<string, Boss> = {
  valento: { id: 'valento', name: 'Valento', location: 'Frozen Sanctuary', level: 92, img: '/bosses/valento.png' },
  kelvezu: { id: 'kelvezu', name: 'Kelvezu', location: 'Kelvezu Cave', level: 92, img: '/bosses/kelvezu.png' },
  gorgoniac: { id: 'gorgoniac', name: 'Gorgoniac', location: 'Endless Tower #1', level: 100, img: '/bosses/gorgoniac.png' },
  draxos: { id: 'draxos', name: 'Draxos', location: 'Secret Lab', level: 108, img: '/bosses/draxos.png' },
  eadric: { id: 'eadric', name: 'Eadric / Vault', location: 'Vaults of Ricarten', level: null, img: '/bosses/eadric.png' },
  dayane: { id: 'dayane', name: 'Dayane', location: 'Whispering Vale', level: null, img: '/bosses/dayane.png' },
  'bloody-king': { id: 'bloody-king', name: 'Bloody King', location: 'Land of Chaos', level: 95, img: '/bosses/bloody-king.png' },
  'devil-shy': { id: 'devil-shy', name: 'Devil Shy', location: 'Endless Tower #2', level: 102, img: '/bosses/devil-shy.png' },
  'primal-golem': { id: 'primal-golem', name: 'Primal Golem', location: 'Forge of the Ancients', level: 115, img: '/bosses/primal-golem.png' },
  deius: { id: 'deius', name: 'Deius', location: 'Land of Neuren', level: 120, img: '/bosses/deius.png' },
  mokova: { id: 'mokova', name: 'Mokova', location: 'Lost Temple', level: 98, img: '/bosses/mokova.png' },
  tulla: { id: 'tulla', name: 'Tulla', location: 'Ice Mine', level: 105, img: '/bosses/tulla.png' },
  greedy: { id: 'greedy', name: 'Greedy', location: 'Ancient Weapon', level: 110, img: '/bosses/greedy.png' },
  aragonian: { id: 'aragonian', name: 'Aragonian', location: 'Cave Crystal Nest', level: 118, img: '/bosses/aragonian.png' },
  yagditha: { id: 'yagditha', name: 'Yagditha', location: 'Abyss of the Sea', level: 113, img: '/bosses/yagditha.png' },
  ignis: { id: 'ignis', name: 'Ignis', location: 'Heart of Fire', level: 113, img: '/bosses/ignis.png' },
};

export const ALL_BOSSES: Boss[] = Object.values(BOSSES);

// Schedule rows: index r = the ":30" hour (0..11). Each boss in a row spawns at
// HH:30 and (HH+12):30 Brasília time. (Reproduces the in-game table exactly.)
export const SCHEDULE_ROWS: string[][] = [
  /* 0  00:30 / 12:30 */ ['valento', 'kelvezu', 'gorgoniac', 'draxos', 'eadric', 'dayane'],
  /* 1  01:30 / 13:30 */ ['bloody-king', 'devil-shy', 'primal-golem', 'deius'],
  /* 2  02:30 / 14:30 */ ['valento', 'mokova', 'tulla'],
  /* 3  03:30 / 15:30 */ ['kelvezu', 'gorgoniac', 'deius', 'greedy', 'aragonian', 'eadric'],
  /* 4  04:30 / 16:30 */ ['valento', 'bloody-king', 'draxos', 'yagditha'],
  /* 5  05:30 / 17:30 */ ['mokova', 'devil-shy', 'ignis', 'deius'],
  /* 6  06:30 / 18:30 */ ['valento', 'kelvezu', 'gorgoniac', 'tulla', 'eadric', 'dayane'],
  /* 7  07:30 / 19:30 */ ['bloody-king', 'primal-golem', 'deius'],
  /* 8  08:30 / 20:30 */ ['valento', 'mokova', 'draxos'],
  /* 9  09:30 / 21:30 */ ['kelvezu', 'gorgoniac', 'devil-shy', 'greedy', 'aragonian', 'eadric'],
  /* 10 10:30 / 22:30 */ ['valento', 'bloody-king', 'yagditha', 'tulla'],
  /* 11 11:30 / 23:30 */ ['mokova', 'ignis', 'deius'],
];

export interface SpawnSlot {
  minute: number; // minutes past midnight (Brasília)
  label: string; // "HH:30"
  bossIds: string[];
}

export function hhmm(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/** All 24 daily spawn slots (each row at r:30 and r+12:30), sorted by time. */
export function daySlots(): SpawnSlot[] {
  const slots: SpawnSlot[] = [];
  SCHEDULE_ROWS.forEach((bossIds, r) => {
    for (const base of [r, r + 12]) {
      const minute = base * 60 + 30;
      slots.push({ minute, label: hhmm(minute), bossIds });
    }
  });
  return slots.sort((a, b) => a.minute - b.minute);
}

/** Current time-of-day in Brasília (GMT-3), in seconds, independent of the user's timezone. */
export function brasiliaSecondsNow(): number {
  const now = new Date();
  const utcSec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  return (((utcSec - 3 * 3600) % 86400) + 86400) % 86400;
}

/** Next `count` spawn slots from `nowSec` (seconds-of-day), with seconds until each. */
export function upcomingSlots(nowSec: number, count: number): { slot: SpawnSlot; inSec: number }[] {
  return daySlots()
    .map((slot) => ({ slot, inSec: (((slot.minute * 60 - nowSec) % 86400) + 86400) % 86400 }))
    .sort((a, b) => a.inSec - b.inSec)
    .slice(0, count);
}

/** Language-neutral countdown: "1h 23m" / "23m 05s" / "05s". */
export function countdown(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** "HH:MM:SS" clock for a seconds-of-day value. */
export function clock(sec: number): string {
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** The soonest spawn for one boss from `nowSec`. */
export function nextForBoss(bossId: string, nowSec: number): { label: string; inSec: number } | null {
  const times = daySlots()
    .filter((s) => s.bossIds.includes(bossId))
    .map((s) => ({ label: s.label, inSec: (((s.minute * 60 - nowSec) % 86400) + 86400) % 86400 }))
    .sort((a, b) => a.inSec - b.inSec);
  return times[0] ?? null;
}
