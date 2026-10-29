// Level ranges that the official export gets wrong for the newest areas. Applied when the quests are read from the database,
// so every screen (list, planner, calculator) sees the real range.
//  - Whispering Vale quests are registered as level 120 only, but they are for level 150 and above (the fusion levels).
//  - Forge of the Ancients, Crystal Nest and Land of Neuren (normal and [H]) and the boss hunts of those areas and of Whispering Vale
//    are still done above level 120, so they have no maximum level.
import type { Quest } from './types';

export const WHISPERING_VALE_CATEGORY = 'whispering-vale';
export const WHISPERING_VALE_MIN_LEVEL = 150;

/** Area categories whose quests have no maximum level (ids are the slug of the category name in the game's export). */
const NO_MAX_CATEGORIES = new Set([
  'forge-of-the-ancients', 'forge-of-the-ancients-h', 'crystal-nest', 'crystal-nest-h', 'land-of-neuren', 'land-of-neuren-h', WHISPERING_VALE_CATEGORY,
]);
/** Boss hunts: Primal Golem (Forge of the Ancients), Aragonian (Crystal Nest), Deius (Land of Neuren), Dayane (Whispering Vale). */
const NO_MAX_BOSS = /^Hunt (Primal Golem|Aragonian|Deius|Dayane) /;

export function applyLevelRules(q: Quest): Quest {
  if (q.categoryId === WHISPERING_VALE_CATEGORY) return { ...q, minLevel: WHISPERING_VALE_MIN_LEVEL, maxLevel: null };
  if (NO_MAX_CATEGORIES.has(q.categoryId) || (q.categoryId === 'boss-hunt' && NO_MAX_BOSS.test(q.name))) return { ...q, maxLevel: null };
  return q;
}
