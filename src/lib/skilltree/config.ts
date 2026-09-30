// Point-progression rules, kept separate from the calculation logic (rules.ts)
// so they're easy to correct without touching any code, per the tool's spec.

/** Skill Points (Tier 1-3): first point at level 10, +1 every 2 levels after
 *  that, through level 120 — confirmed against pristontale.eu: 10,12,...,120
 *  = 56 points from leveling, +4 more available from quests (below) = 60 max. */
export const SKILL_POINTS = {
  startLevel: 10,
  interval: 2,
  capLevel: 120,
};

/**
 * Elite Points (Tier 4 only): NOT published anywhere on pristontale.eu — this
 * progression is DERIVED, not confirmed by an official source. Reasoning:
 *   - Every one of the 10 classes' Tier 4 has the exact same shape: 3 skills
 *     unlocking at level 60/63/66 (max level 10 each) + 1 Ultimate unlocking
 *     at 70 (max level 1) — a total capacity of exactly 31 points, fully
 *     completable by level 120 (last required level is ~111).
 *   - The same cadence already used for Skill Points (+1 every 2 levels),
 *     just started at level 60 instead of 10, produces EXACTLY 31 points by
 *     level 120: (120-60)/2 + 1 = 31.
 * Both facts point the same way, but if you find the real per-level table,
 * replace this block (e.g. with an explicit `pointsByLevel` array) — nothing
 * else in the tool needs to change, see getAvailableElitePoints() in rules.ts.
 */
export const ELITE_POINTS = {
  startLevel: 60,
  interval: 2,
  capLevel: 120,
};

export interface SkillPointQuest {
  id: string;
  nameKey: string; // i18n key for the quest name shown in the UI
  points: number;
}

/** Quests granting extra Skill Points (Tier 1-3 only) — from the tool's spec. */
export const SKILL_POINT_QUESTS: SkillPointQuest[] = [
  { id: 'the-cave', nameKey: 'sk.quest.thecave', points: 1 },
  { id: 'friendship-michell', nameKey: 'sk.quest.friendship', points: 1 },
  { id: 'iron-out-details', nameKey: 'sk.quest.ironout', points: 2 },
];
