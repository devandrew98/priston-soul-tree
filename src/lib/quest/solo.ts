// Solo quests ("Solo Quest | <area>"): there is one per hunting area, and only the one of the character's current level matters
// (the older ones give far less EXP). So the list shows only the highest solo the character can do.
import type { Quest } from './types';

export const isSolo = (q: Pick<Quest, 'name'>): boolean => /^Solo Quest\s*\|/i.test(q.name);

/**
 * Level from which each solo is the current one, when that is not simply its minimum level.
 * Whispering Vale and Land of Neuren are both registered from level 120, but Whispering Vale is the one for level 150 and above.
 */
const CURRENT_FROM: Record<string, number> = { 'whispering vale': 150 };

const area = (q: Pick<Quest, 'name'>) => q.name.split('|')[1]?.trim().toLowerCase() ?? '';
const currentFrom = (q: Pick<Quest, 'name' | 'minLevel'>) => CURRENT_FROM[area(q)] ?? q.minLevel ?? 0;

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
