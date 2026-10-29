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
    expect(questMapGroup({ map: 'Ice Mine 1', npc: 'Boss Hunter, William' })).toBe(BOSS_GROUP);
    expect(questMapGroup({ map: 'Ice Mine 1', npc: 'Someone else' })).toBe('Ice Mine 1');
  });
});
