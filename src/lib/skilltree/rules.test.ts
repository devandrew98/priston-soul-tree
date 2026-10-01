import { describe, expect, it } from 'vitest';
import { getSkillClass } from './classes';
import { applySkillChange, sanitizeBuild } from './rules';

const cls = getSkillClass('fighter');
const base = cls.tiers.filter((t) => t.tier !== 4).flatMap((t) => t.skills);
const elite = cls.tiers.find((t) => t.tier === 4)!.skills;

describe('Tier 4 gate', () => {
  it('investing in a Tier 4 skill fills 1 point in every Tier 1-3 skill and earlier Tier 4 skill', () => {
    const target = elite[2];
    const result = applySkillChange('fighter', 120, [], {}, target.id, 1);
    for (const s of base) expect(result[s.id]).toBe(1);
    expect(result[elite[0].id]).toBe(1);
    expect(result[elite[1].id]).toBe(1);
    expect(result[target.id]).toBe(1);
  });

  it('keeps already-invested Tier 1-3 skills untouched', () => {
    const result = applySkillChange('fighter', 120, [], { [base[0].id]: 7 }, elite[0].id, 1);
    expect(result[base[0].id]).toBe(7);
    expect(result[base[base.length - 1].id]).toBe(1);
  });

  it('clears Tier 4 when any Tier 1-3 skill has no point', () => {
    const levels = Object.fromEntries([...base, ...elite].map((s) => [s.id, 1]));
    levels[base[base.length - 1].id] = 0;
    const result = sanitizeBuild('fighter', 120, [], levels);
    for (const s of elite) expect(result[s.id] ?? 0).toBe(0);
  });
});
