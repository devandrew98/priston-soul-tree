import { describe, expect, it } from 'vitest';
import { getSkillClass } from './classes';
import { decodeSkillBar, emptySkillBar, encodeSkillBar, placeOnBar, sanitizeSkillBar } from './skillBar';

const skills = getSkillClass('fighter').tiers.flatMap((t) => t.skills);
const active = skills.filter((s) => s.type !== 'passive');
const passive = skills.find((s) => s.type === 'passive')!;
const learned = Object.fromEntries(skills.map((s) => [s.id, 1]));

describe('skill bar', () => {
  it('moves a skill from the book instead of duplicating it', () => {
    let bar = placeOnBar(emptySkillBar(), active[0].id, 0, null);
    bar = placeOnBar(bar, active[0].id, 5, null);
    expect(bar[0]).toBeNull();
    expect(bar[5]).toBe(active[0].id);
  });

  it('swaps two slots when dragging between them', () => {
    let bar = placeOnBar(emptySkillBar(), active[0].id, 0, null);
    bar = placeOnBar(bar, active[1].id, 1, null);
    bar = placeOnBar(bar, active[0].id, 1, 0);
    expect(bar[0]).toBe(active[1].id);
    expect(bar[1]).toBe(active[0].id);
  });

  it('drops passive and unlearned skills', () => {
    const bar = emptySkillBar();
    bar[0] = passive.id;
    bar[1] = active[0].id;
    bar[2] = active[1].id;
    const fixed = sanitizeSkillBar('fighter', { ...learned, [active[1].id]: 0 }, bar);
    expect(fixed.slice(0, 3)).toEqual([null, active[0].id, null]);
  });

  it('round-trips through the share code', () => {
    let bar = placeOnBar(emptySkillBar(), active[0].id, 0, null);
    bar = placeOnBar(bar, active[3].id, 17, null);
    expect(decodeSkillBar('fighter', encodeSkillBar('fighter', bar))).toEqual(bar);
    expect(encodeSkillBar('fighter', emptySkillBar())).toBe('');
  });
});
