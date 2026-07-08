// Priston Tale EU "Fury" spawn schedule.
// Like the boss schedule, anchored to the game's OFFICIAL time = GMT 0 (UTC).
// Fury is split into three level ranges, each with its own set of on-the-hour spawns.
import { nextOccurrence, RECENT_SEC } from './bosses';

export interface FuryLevel {
  id: string;
  name: string; // level-range label, shown as-is in PT/EN
  speech: { pt: string; en: string }; // spelled-out level range for the voice alert
  hours: number[]; // GMT-0 hours the Fury spawns at
  tone: string; // accent color for the 3D glow / card border
  img: string; // Fury portrait (same creature for every level range)
}

// Same Fury creature across all ranges — only the level bracket / schedule differ.
export const FURY_IMG = '/fury/fury.gif';

// `speech` spells the range out in words so the TTS reads "cento e quatro"
// instead of spelling the digits ("um, zero, quatro").
export const FURY_LEVELS: FuryLevel[] = [
  { id: 'fury-70-88', name: 'Level 70–88', speech: { pt: 'setenta ao oitenta e oito', en: 'seventy to eighty-eight' }, hours: [0, 3, 6, 9, 12, 15, 18], tone: '#6fbf73', img: FURY_IMG },
  { id: 'fury-89-103', name: 'Level 89–103', speech: { pt: 'oitenta e nove ao cento e três', en: 'eighty-nine to one hundred three' }, hours: [1, 4, 7, 10, 13, 16, 19, 22], tone: '#5aa9e6', img: FURY_IMG },
  { id: 'fury-104', name: 'Level 104+', speech: { pt: 'cento e quatro', en: 'one hundred four' }, hours: [2, 5, 8, 11, 14, 17, 20, 23], tone: '#e0663b', img: FURY_IMG },
];

export const FURY_BY_ID: Record<string, FuryLevel> = Object.fromEntries(FURY_LEVELS.map((l) => [l.id, l]));

export interface FuryEvent {
  level: FuryLevel;
  when: Date; // absolute moment of the relevant occurrence
  state: 'spawned' | 'upcoming';
  sec: number; // seconds since spawn (spawned) or until spawn (upcoming)
}

const DAY_MS = 86400000;

/** Build the ordered event list across every level: just-spawned first, then upcoming (soonest). */
export function buildFuryEvents(now: Date): FuryEvent[] {
  const out: FuryEvent[] = [];
  for (const level of FURY_LEVELS) {
    // Soonest occurrence for this level = min next over all its hours.
    let next: Date | null = null;
    for (const h of level.hours) {
      const cand = nextOccurrence(h * 60, now);
      if (!next || cand.getTime() < next.getTime()) next = cand;
    }
    if (!next) continue;
    const last = new Date(next.getTime() - DAY_MS);
    const untilNext = Math.round((next.getTime() - now.getTime()) / 1000);
    const sinceLast = Math.round((now.getTime() - last.getTime()) / 1000);
    if (sinceLast >= 0 && sinceLast <= RECENT_SEC) {
      out.push({ level, when: last, state: 'spawned', sec: sinceLast });
    } else {
      out.push({ level, when: next, state: 'upcoming', sec: untilNext });
    }
  }
  out.sort((a, b) => (a.state !== b.state ? (a.state === 'spawned' ? -1 : 1) : a.sec - b.sec));
  return out;
}

/** The soonest upcoming spawn for one level. */
export function nextForLevel(levelId: string, now: Date): { when: Date; sec: number } | null {
  const level = FURY_BY_ID[levelId];
  if (!level) return null;
  let best: { when: Date; sec: number } | null = null;
  for (const h of level.hours) {
    const next = nextOccurrence(h * 60, now);
    const sec = Math.round((next.getTime() - now.getTime()) / 1000);
    if (!best || sec < best.sec) best = { when: next, sec };
  }
  return best;
}
