import { describe, expect, it } from 'vitest';
import { groupByMap } from './mapGroups';

interface Q { name: string; map: string; exp: number; min: number | null }
const g = (list: Q[]) => groupByMap(list, (q) => q.map, (q) => q.exp, (q) => q.min, (q) => q.name);

describe('groupByMap', () => {
  const list: Q[] = [
    { name: 'a', map: 'Low', exp: 5000, min: 50 }, { name: 'b', map: 'High', exp: 100, min: 110 }, { name: 'c', map: 'High', exp: 900, min: 110 },
    { name: 'd', map: 'Low', exp: 10, min: 50 },
  ];
  it('puts the higher-level map first, even if a lower map gives more EXP', () => {
    expect(g(list).map((x) => x.map)).toEqual(['High', 'Low']);
  });
  it('keeps every quest in its own map, most EXP first', () => {
    const r = g(list);
    expect(r[0].items.map((q) => q.name)).toEqual(['c', 'b']);
    expect(r[1].items.map((q) => q.name)).toEqual(['a', 'd']);
  });
  it('a quest without a map goes to its own group', () => {
    expect(g([{ name: 'x', map: '', exp: 1, min: null }])[0].map).toBe('—');
  });
});

import { BOSS_GROUP, displayMap, questMapGroup } from './mapGroups';

describe('map names and the boss block', () => {
  it('writes hard maps with [H]', () => {
    expect(displayMap('Forge of the Ancients H')).toBe('Forge of the Ancients [H]');
    expect(displayMap('Crystal Nest [H]')).toBe('Crystal Nest [H]');
    expect(displayMap('Land of Neuren')).toBe('Land of Neuren');
  });
  it('the quests of the NPC Boss Hunter go to one block, the others to their map', () => {
    expect(questMapGroup({ name: 'Hunt Tulla', map: 'Ice Mine 1', npc: 'Boss Hunter, William' })).toBe(BOSS_GROUP);
    expect(questMapGroup({ name: 'Kill 5 B', map: 'Ice Mine 1', npc: 'Someone else' })).toBe('Ice Mine 1');
  });
});

import { SOLO_GROUP, groupQuests } from './mapGroups';

describe('groupQuests', () => {
  const q = (name: string, map: string, npc: string, minLevel: number, exp: number) => ({ name, map, npc, minLevel, exp });
  const list = [
    q('Solo Quest | Crystal Nest', 'Crystal Nest', 'Sopphetio', 118, 900),
    q('Kill 10 A', 'Crystal Nest', 'Quinox', 118, 100),
    q('Hunt Ignis', 'Heart of Fire', 'Boss Hunter, William', 113, 1500),
    q('Hunt Aragonian', "Aragonian's Lair", 'Boss Hunter, William', 118, 2700),
    q('Hunt Yagditha', 'Abyss of the Sea', 'Boss Hunter, William', 113, 1600),
    q('Kill 5 B', 'Ice Mine 1', 'Quinox', 105, 500),
    q('[SOLO] Kill 2 Flamo', 'Heart of Fire', 'Someone', 113, 50),
  ];
  const r = groupQuests(list, (x) => x, (x) => x.exp);
  it('maps first (highest level first), then the boss hunts, then the solo quests last', () => {
    expect(r.map((g) => g.map)).toEqual(['Crystal Nest', 'Ice Mine 1', 'Boss Hunter (William)', SOLO_GROUP]);
  });
  it('the solo quests leave their maps', () => {
    expect(r[0].items.map((x) => x.name)).toEqual(['Kill 10 A']);
    expect(r[3].items.map((x) => x.name)).toEqual(['Solo Quest | Crystal Nest', '[SOLO] Kill 2 Flamo']);
  });
  it('the boss hunts go by the level of their map, then by EXP', () => {
    expect(r[2].items.map((x) => x.name)).toEqual(['Hunt Aragonian', 'Hunt Yagditha', 'Hunt Ignis']);
  });
});
