// Solo quests ("Solo Quest | <area>"): there is one per hunting area, and only the one of the character's current level matters
// (the older ones give far less EXP). So the list shows only the highest solo the character can do.
// (Whispering Vale starts at level 150 through lib/quest/levelRules.ts, so it simply is the highest one from there.)
import type { Quest } from './types';

export const isSolo = (q: Pick<Quest, 'name'>): boolean => /^Solo Quest\s*\|/i.test(q.name);

const currentFrom = (q: Pick<Quest, 'minLevel'>) => q.minLevel ?? 0;

/** The id of the solo quest for `level`: the one with the highest start level that is not above it. null if there is none yet. */
export function currentSoloId(quests: Pick<Quest, 'id' | 'name' | 'minLevel'>[], level: number): string | null {
  let best: { id: string; from: number } | null = null;
  for (const q of quests) {
    if (!isSolo(q)) continue;
    const from = currentFrom(q);
    if (from <= level && (!best || from > best.from)) best = { id: q.id, from };
  }
  return best?.id ?? null;
}
