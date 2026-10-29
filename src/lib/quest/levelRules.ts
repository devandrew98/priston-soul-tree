// Level ranges that the official export gets wrong for the quests of the newest area.
// The Whispering Vale quests are registered as level 120 only, but they are for level 150 and above (the fusion levels).
// Applied when the quests are read from the database, so every screen (list, planner, calculator) sees the real range.
import type { Quest } from './types';

export const WHISPERING_VALE_CATEGORY = 'whispering-vale';
export const WHISPERING_VALE_MIN_LEVEL = 150;

export function applyLevelRules(q: Quest): Quest {
  if (q.categoryId !== WHISPERING_VALE_CATEGORY) return q;
  return { ...q, minLevel: WHISPERING_VALE_MIN_LEVEL, maxLevel: null };
}
