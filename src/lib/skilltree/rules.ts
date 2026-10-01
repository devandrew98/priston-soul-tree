// Central game rules for the Skill Tree — every calculation and every
// validation the UI needs goes through here, so a build can never end up in
// a state the game itself wouldn't allow (including builds loaded from a
// shared/manipulated URL).
import { ELITE_POINTS, SKILL_POINTS, SKILL_POINT_QUESTS } from './config';
import { getSkillClass, isClassSlug } from './classes';
import type { Build, ClassSlug, Skill, SkillLevels } from './types';

function pointsFromLadder(level: number, cfg: { startLevel: number; interval: number; capLevel: number }): number {
  const lvl = Math.min(level, cfg.capLevel);
  if (lvl < cfg.startLevel) return 0;
  return Math.floor((lvl - cfg.startLevel) / cfg.interval) + 1;
}

/** Skill Points from leveling alone (Tier 1-3), before quest bonuses. */
export function getBaseSkillPoints(characterLevel: number): number {
  return pointsFromLadder(characterLevel, SKILL_POINTS);
}

/** Skill Points available for Tier 1-3, including completed-quest bonuses. */
export function getAvailableSkillPoints(characterLevel: number, completedQuestIds: string[]): number {
  const questBonus = SKILL_POINT_QUESTS
    .filter((q) => completedQuestIds.includes(q.id))
    .reduce((sum, q) => sum + q.points, 0);
  return getBaseSkillPoints(characterLevel) + questBonus;
}

/** Elite Points available for Tier 4 — see config.ts for why this formula. */
export function getAvailableElitePoints(characterLevel: number): number {
  return pointsFromLadder(characterLevel, ELITE_POINTS);
}

/** Character level required to raise a skill to `targetSkillLevel`. */
export function getRequiredCharacterLevel(skillUnlockLevel: number, targetSkillLevel: number): number {
  return skillUnlockLevel + (targetSkillLevel - 1) * 5;
}

/** Highest level a character could put into this skill right now, ignoring points budget. */
export function getMaxAllowedSkillLevel(skill: Skill, characterLevel: number): number {
  if (characterLevel < skill.unlockLevel) return 0;
  const byLevel = Math.floor((characterLevel - skill.unlockLevel) / 5) + 1;
  return Math.max(0, Math.min(skill.maxLevel, byLevel));
}

export function usesElitePoints(skill: Skill): boolean {
  return skill.tier === 4;
}

export interface SplitTotals { skillPointsUsed: number; elitePointsUsed: number }

export function splitUsedPoints(classSlug: ClassSlug, skillLevels: SkillLevels): SplitTotals {
  const cls = getSkillClass(classSlug);
  let skillPointsUsed = 0;
  let elitePointsUsed = 0;
  for (const tier of cls.tiers) {
    for (const skill of tier.skills) {
      const lvl = skillLevels[skill.id] ?? 0;
      if (usesElitePoints(skill)) elitePointsUsed += lvl;
      else skillPointsUsed += lvl;
    }
  }
  return { skillPointsUsed, elitePointsUsed };
}

/**
 * The two prerequisite chains: Tier 1-3 share one continuous chain (they all
 * spend Skill Points), while Tier 4 is its own chain (it spends Elite
 * Points). A skill can only keep points if every skill before it in its
 * chain already has at least 1 point — and the Tier 4 chain only opens once
 * every Tier 1-3 skill has at least 1 point (different pools, same gate).
 */
function getSkillChain(cls: ReturnType<typeof getSkillClass>, elite: boolean): Skill[] {
  return cls.tiers
    .filter((t) => (t.tier === 4) === elite)
    .flatMap((t) => t.skills);
}

/**
 * Clamps every invested skill level down to what's actually affordable and
 * level-legal, walking each prerequisite chain in order so the result is
 * deterministic. A broken prerequisite (e.g. the character level dropped, or
 * a build was decoded from a manipulated URL) cascades down and clears
 * everything that depended on it. This never grants points that weren't
 * already requested — it only ever removes or clamps — which is what makes
 * it safe to run on shared/manipulated build URLs.
 */
export function sanitizeBuild(classSlug: ClassSlug, level: number, questIds: string[], skillLevels: SkillLevels): SkillLevels {
  const cls = getSkillClass(classSlug);
  const validQuestIds = questIds.filter((id) => SKILL_POINT_QUESTS.some((q) => q.id === id));

  const next: SkillLevels = {};

  const runChain = (chain: Skill[], budget: number, unlocked = true): void => {
    let remaining = budget;
    let chainOk = unlocked; // the skill before this one (if any) still has >=1 point
    for (const skill of chain) {
      const requested = Math.max(0, Math.floor(skillLevels[skill.id] ?? 0));
      const levelCap = getMaxAllowedSkillLevel(skill, level);
      const finalLevel: number = chainOk ? Math.min(requested, levelCap, remaining) : 0;
      if (finalLevel > 0) {
        next[skill.id] = finalLevel;
        remaining -= finalLevel;
      }
      chainOk = finalLevel > 0;
    }
  };

  const baseChain = getSkillChain(cls, false);
  runChain(baseChain, getAvailableSkillPoints(level, validQuestIds));
  const tier4Unlocked = baseChain.every((s) => (next[s.id] ?? 0) > 0);
  runChain(getSkillChain(cls, true), getAvailableElitePoints(level), tier4Unlocked);

  return next;
}

/**
 * Applies a single skill +/-/MAX change and returns the resulting sanitized
 * build. Investing further into a skill (not removing points) auto-invests
 * the minimum 1 point into every earlier skill in the same prerequisite
 * chain (Tier 1-3 combined, or Tier 4 on its own) that's still at 0 — and a
 * Tier 4 skill also fills every Tier 1-3 skill that's still at 0, since Tier 4
 * stays closed until they all have a point. Already-invested earlier skills
 * are left untouched. Removing the last
 * point from a skill relies on sanitizeBuild's chain check to cascade the
 * removal to whatever depended on it.
 */
export function applySkillChange(
  classSlug: ClassSlug,
  level: number,
  questIds: string[],
  skillLevels: SkillLevels,
  skillId: string,
  desiredLevel: number,
): SkillLevels {
  const currentLevel = skillLevels[skillId] ?? 0;
  const candidate: SkillLevels = { ...skillLevels, [skillId]: Math.max(0, desiredLevel) };

  if (desiredLevel > currentLevel) {
    const cls = getSkillClass(classSlug);
    const targetSkill = cls.tiers.flatMap((t) => t.skills).find((s) => s.id === skillId);
    if (targetSkill) {
      const elite = usesElitePoints(targetSkill);
      const chain = getSkillChain(cls, elite);
      const idx = chain.findIndex((s) => s.id === skillId);
      const prereqs = [...(elite ? getSkillChain(cls, false) : []), ...chain.slice(0, idx)];
      for (const prior of prereqs) {
        if ((candidate[prior.id] ?? 0) < 1) candidate[prior.id] = 1;
      }
    }
  }

  return sanitizeBuild(classSlug, level, questIds, candidate);
}

export interface ValidatedBuild {
  classSlug: ClassSlug;
  level: number;
  questIds: string[];
  skillLevels: SkillLevels;
  wasSanitized: boolean;
}

/** Validates (and if needed, silently corrects) a build — the single gate
 *  everything goes through: user interaction, shared links, everything. */
export function validateBuild(input: { classSlug: string; level: number; questIds: string[]; skillLevels: SkillLevels }): ValidatedBuild {
  const classSlug: ClassSlug = isClassSlug(input.classSlug) ? input.classSlug : 'fighter';
  const level = Math.max(1, Math.min(120, Math.floor(input.level) || 1));
  const questIds = [...new Set(input.questIds)].filter((id) => SKILL_POINT_QUESTS.some((q) => q.id === id));
  const sanitized = sanitizeBuild(classSlug, level, questIds, input.skillLevels);

  const before = JSON.stringify(Object.entries(input.skillLevels).filter(([, v]) => v > 0).sort());
  const after = JSON.stringify(Object.entries(sanitized).filter(([, v]) => v > 0).sort());
  const wasSanitized = before !== after || classSlug !== input.classSlug || level !== input.level;

  return { classSlug, level, questIds, skillLevels: sanitized, wasSanitized };
}

export function emptyBuild(classSlug: ClassSlug): Build {
  return { classSlug, level: 1, questIds: [], skillLevels: {} };
}
