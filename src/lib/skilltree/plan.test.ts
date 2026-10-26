import { describe, expect, it } from 'vitest';
import { getSkillClass } from './classes';
import { buildLevelPlan, groupPlan } from './plan';
import { getRequiredCharacterLevel, sanitizeBuild, splitUsedPoints } from './rules';
import type { SkillLevels } from './types';

const cls = getSkillClass('fighter');
const all = cls.tiers.flatMap((t) => t.skills);
const base = all.filter((s) => s.tier !== 4);
const elite = all.filter((s) => s.tier === 4);

/** A legal build for level 120: everything at 1, plus the whole first skill and the Ultimate. */
function sampleTarget(): SkillLevels {
  const raw: SkillLevels = Object.fromEntries(all.map((s) => [s.id, 1]));
  raw[base[0].id] = 10;
  raw[base[1].id] = 10;
  return sanitizeBuild('fighter', 120, [], raw);
}

describe('level plan', () => {
  it('reaches exactly the target build', () => {
    const target = sampleTarget();
    const plan = buildLevelPlan('fighter', target, 'order', 120);
    const final: SkillLevels = {};
    for (const s of plan.steps) final[s.skillId] = s.rank;
    expect(final).toEqual(Object.fromEntries(Object.entries(target).filter(([, v]) => v > 0)));
  });

  it('never spends a point before the game would allow it', () => {
    for (const priority of ['order', 'spread'] as const) {
      const plan = buildLevelPlan('fighter', sampleTarget(), priority, 120);
      const cur: SkillLevels = {};
      for (const step of plan.steps) {
        const skill = all.find((s) => s.id === step.skillId)!;
        const level = step.level ?? 120;
        // rank rule
        expect(level).toBeGreaterThanOrEqual(getRequiredCharacterLevel(skill.unlockLevel, step.rank));
        // chain rule: everything before it in its chain already has a point
        const chain = step.elite ? elite : base;
        for (const earlier of chain.slice(0, chain.indexOf(skill))) expect(cur[earlier.id] ?? 0).toBeGreaterThanOrEqual(1);
        // tier 4 needs all of tier 1-3 opened
        if (step.elite) for (const b of base) expect(cur[b.id] ?? 0).toBeGreaterThanOrEqual(1);
        cur[step.skillId] = step.rank;
      }
    }
  });

  it('never uses more points than the levels have granted by then', () => {
    const plan = buildLevelPlan('fighter', sampleTarget(), 'spread', 120);
    for (const level of [10, 20, 40, 60, 80, 100, 120]) {
      const spSpent = plan.steps.filter((s) => !s.elite && s.level !== null && s.level <= level).length;
      const granted = level < 10 ? 0 : Math.floor((level - 10) / 2) + 1;
      expect(spSpent).toBeLessThanOrEqual(granted);
    }
  });

  it('keeps leftover target points (quest bonus) at the end with level null', () => {
    // 60 Tier 1-3 points requested but only 56 come from leveling.
    const raw: SkillLevels = {};
    for (const s of base) raw[s.id] = 5;
    const target = sanitizeBuild('fighter', 120, ['the-cave', 'friendship-michell', 'iron-out-details'], raw);
    const wanted = splitUsedPoints('fighter', target).skillPointsUsed;
    const plan = buildLevelPlan('fighter', target, 'order', 120);
    const spSteps = plan.steps.filter((s) => !s.elite);
    expect(spSteps).toHaveLength(wanted);
    expect(spSteps.filter((s) => s.level === null).length).toBe(Math.max(0, wanted - 56));
  });

  it('spread opens skills evenly while order fills the first skill first', () => {
    const target = sampleTarget();
    const ordered = buildLevelPlan('fighter', target, 'order', 120).steps.filter((s) => !s.elite);
    const spread = buildLevelPlan('fighter', target, 'spread', 120).steps.filter((s) => !s.elite);
    const firstId = base[0].id;
    const rankAt = (steps: typeof ordered, n: number) => steps.slice(0, n).filter((s) => s.skillId === firstId).length;
    expect(rankAt(ordered, 14)).toBeGreaterThan(rankAt(spread, 14));
  });

  it('groups steps by level', () => {
    const rows = groupPlan(buildLevelPlan('fighter', sampleTarget(), 'order', 120).steps);
    const levels = rows.map((r) => r.level).filter((l): l is number => l !== null);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels); // chronological
    expect(new Set(levels).size).toBe(levels.length); // one row per level
  });

  it('is empty for an empty build', () => {
    expect(buildLevelPlan('fighter', {}, 'order', 120).steps).toHaveLength(0);
  });
});
