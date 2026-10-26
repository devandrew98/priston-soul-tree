import { describe, expect, it } from 'vitest';
import { encodeBuild } from './buildCode';
import { getSkillClass } from './classes';
import { compareBuilds, parseShareLink } from './compare';
import { sanitizeBuild } from './rules';
import type { SkillLevels } from './types';

const fighter = getSkillClass('fighter').tiers.flatMap((t) => t.skills);

function link(levels: SkillLevels, level = 120, extra = ''): string {
  return `https://pristonzone.com/skill-tree/fighter?level=${level}&build=${encodeBuild('fighter', [], levels)}${extra}`;
}

describe('parseShareLink', () => {
  it('reads a build link back into the same skill levels', () => {
    const levels = sanitizeBuild('fighter', 120, [], { [fighter[0].id]: 5, [fighter[1].id]: 1 });
    const parsed = parseShareLink(link(levels, 120, '&name=PvP%20build'));
    expect(parsed).toMatchObject({ classSlug: 'fighter', level: 120, name: 'PvP build' });
    expect(parsed?.skillLevels).toEqual(levels);
  });

  it('accepts a relative link and ignores the bar parameter', () => {
    const levels = sanitizeBuild('fighter', 120, [], { [fighter[0].id]: 3 });
    expect(parseShareLink(link(levels).replace('https://pristonzone.com', '') + '&bar=01')?.skillLevels).toEqual(levels);
  });

  it('refuses anything that is not a build link', () => {
    expect(parseShareLink('')).toBeNull();
    expect(parseShareLink('hello')).toBeNull();
    expect(parseShareLink('https://pristonzone.com/souls')).toBeNull();
    expect(parseShareLink('https://pristonzone.com/skill-tree/notaclass?build=AA')).toBeNull();
    expect(parseShareLink('https://pristonzone.com/skill-tree/fighter')).toBeNull();
  });

  it('cannot smuggle an illegal build in: it is sanitized like any shared link', () => {
    const cheating: SkillLevels = Object.fromEntries(fighter.map((s) => [s.id, 10]));
    const parsed = parseShareLink(link(cheating, 10));
    const total = Object.values(parsed!.skillLevels).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(1); // level 10 grants a single Skill Point
  });
});

describe('compareBuilds', () => {
  const a = { classSlug: 'fighter' as const, level: 120, skillLevels: { [fighter[0].id]: 5, [fighter[1].id]: 1 } };
  const b = { classSlug: 'fighter' as const, level: 120, skillLevels: { [fighter[0].id]: 3, [fighter[1].id]: 1, [fighter[2].id]: 2 } };

  it('lists skills with their levels and the difference', () => {
    const c = compareBuilds(a, b);
    expect(c.sameClass).toBe(true);
    expect(c.rows.map((r) => [r.a, r.b, r.delta])).toEqual([[5, 3, -2], [1, 1, 0], [0, 2, 2]]);
    expect(c.differing).toBe(2);
    expect(c.a.sp).toBe(6);
    expect(c.b.sp).toBe(6);
  });

  it('refuses to compare different classes', () => {
    const c = compareBuilds(a, { classSlug: 'archer', level: 120, skillLevels: {} });
    expect(c.sameClass).toBe(false);
    expect(c.rows).toEqual([]);
  });
});
