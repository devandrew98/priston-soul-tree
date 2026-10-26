// "Plano de pontos por nível": given the build the player wants to END with, work out which
// skill each point should go to, level by level, using the same rules the game (and rules.ts)
// enforces:
//   * Skill Points (Tier 1-3) are granted at level 10 and every 2 levels after; Elite Points
//     (Tier 4) from level 60 every 2 levels (config.ts).
//   * Rank r of a skill needs character level >= unlockLevel + 5 * (r - 1).
//   * A skill can only receive points once every skill before it in its chain has at least 1
//     point, and Tier 4 only opens once every Tier 1-3 skill has at least 1 point.
// Points that can't be placed yet (e.g. the next skill unlocks at level 40) simply wait in the
// bank and are placed at the first level where something becomes possible.
import { ELITE_POINTS, SKILL_POINTS } from './config';
import { getSkillClass } from './classes';
import { usesElitePoints } from './rules';
import type { ClassSlug, Skill, SkillLevels } from './types';

export type PlanPriority = 'order' | 'spread';

export interface PlanStep {
  /** Character level at which the point is spent; null = bonus points from quests (any time). */
  level: number | null;
  skillId: string;
  elite: boolean;
  /** The skill's rank after this point. */
  rank: number;
}

export interface LevelPlan {
  steps: PlanStep[];
  /** Points that were granted by leveling but nothing could take yet at the end. */
  unspentSp: number;
  unspentEp: number;
}

const grantsAt = (level: number, cfg: { startLevel: number; interval: number; capLevel: number }): boolean =>
  level >= cfg.startLevel && level <= cfg.capLevel && (level - cfg.startLevel) % cfg.interval === 0;

/** Level needed to put the NEXT point (rank current+1) into the skill. */
const levelForNextRank = (skill: Skill, current: number): number => skill.unlockLevel + 5 * current;

export function buildLevelPlan(classSlug: ClassSlug, target: SkillLevels, priority: PlanPriority, characterLevel: number): LevelPlan {
  const cls = getSkillClass(classSlug);
  const all = cls.tiers.flatMap((t) => t.skills);
  const base = all.filter((s) => !usesElitePoints(s));
  const elite = all.filter((s) => usesElitePoints(s));
  const want = (s: Skill) => Math.max(0, Math.floor(target[s.id] ?? 0));
  const cur: Record<string, number> = {};
  for (const s of all) cur[s.id] = 0;

  const baseOpen = () => base.every((s) => cur[s.id] >= 1);

  /** Picks the skill that should get the next point at `level`, or null when nothing can take one. */
  const pick = (chain: Skill[], level: number, requireBaseOpen: boolean): Skill | null => {
    if (requireBaseOpen && !baseOpen()) return null;
    const allowed: Skill[] = [];
    for (let i = 0; i < chain.length; i++) {
      const s = chain[i];
      if (cur[s.id] < want(s) && level >= levelForNextRank(s, cur[s.id])) allowed.push(s);
      // A locked, still-empty skill blocks everything after it (they need it opened first).
      if (cur[s.id] === 0 && level < levelForNextRank(s, 0)) break;
    }
    if (allowed.length === 0) return null;
    if (priority === 'order') return allowed[0];
    // spread: lowest current rank first (ties keep chain order, which is also the opening order)
    return allowed.reduce((best, s) => (cur[s.id] < cur[best.id] ? s : best), allowed[0]);
  };

  const steps: PlanStep[] = [];
  let spBank = 0;
  let epBank = 0;
  const spend = (chain: Skill[], level: number, isElite: boolean) => {
    for (;;) {
      if (isElite ? epBank <= 0 : spBank <= 0) return;
      const s = pick(chain, level, isElite);
      if (!s) return;
      cur[s.id] += 1;
      if (isElite) epBank -= 1; else spBank -= 1;
      steps.push({ level, skillId: s.id, elite: isElite, rank: cur[s.id] });
    }
  };

  const last = Math.max(1, Math.min(120, Math.floor(characterLevel) || 1));
  for (let level = 1; level <= last; level++) {
    if (grantsAt(level, SKILL_POINTS)) spBank += 1;
    if (grantsAt(level, ELITE_POINTS)) epBank += 1;
    spend(base, level, false);
    spend(elite, level, true);
  }
  const unspentSp = spBank;
  const unspentEp = epBank;

  // Whatever the target still needs beyond the level-based points came from quests (Tier 1-3 only):
  // those can be spent whenever, so they are listed at the end with level = null.
  for (;;) {
    const s = pick(base, last, false);
    if (!s) break;
    cur[s.id] += 1;
    steps.push({ level: null, skillId: s.id, elite: false, rank: cur[s.id] });
  }

  return { steps, unspentSp, unspentEp };
}

export interface PlanRow {
  level: number | null;
  /** One entry per distinct skill that got points at this level, with how many and the final rank. */
  items: { skillId: string; elite: boolean; points: number; rank: number }[];
}

/** Groups the steps by level (and merges repeated points into the same skill). */
export function groupPlan(steps: PlanStep[]): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const step of steps) {
    let row = rows.find((r) => r.level === step.level);
    if (!row) { row = { level: step.level, items: [] }; rows.push(row); }
    const item = row.items.find((i) => i.skillId === step.skillId);
    if (item) { item.points += 1; item.rank = step.rank; }
    else row.items.push({ skillId: step.skillId, elite: step.elite, points: 1, rank: step.rank });
  }
  return rows;
}
