import { describe, expect, it } from 'vitest';
import { questInfo } from './availability';
import { applyLevelRules } from './levelRules';
import type { Quest } from './types';

const quest = (over: Partial<Quest>): Quest => ({
  id: 'q', name: 'Kill 80 Lufia in Whispering Vale', categoryId: 'whispering-vale', minLevel: 120, maxLevel: 120, map: 'Whispering Vale', npc: '', description: '',
  objectives: [], baseExp: 2371846426, prerequisites: [], repeatType: 'once', repeatIntervalHours: null, active: true, archived: false, ...over,
});

describe('Whispering Vale level range', () => {
  it('is level 150 and above, with no maximum', () => {
    expect(applyLevelRules(quest({}))).toMatchObject({ minLevel: 150, maxLevel: null });
  });
  it('is locked at level 120 and available from 150 on', () => {
    const q = applyLevelRules(quest({}));
    expect(questInfo(q, { level: 120, progress: {} }, 0).status).toBe('locked');
    expect(questInfo(q, { level: 149, progress: {} }, 0).status).toBe('locked');
    expect(questInfo(q, { level: 150, progress: {} }, 0).status).toBe('available');
    expect(questInfo(q, { level: 180, progress: {} }, 0).status).toBe('available');
  });
  it('Forge of the Ancients, Crystal Nest and Land of Neuren (normal and [H]) have no maximum, and keep their minimum', () => {
    for (const categoryId of ['forge-of-the-ancients', 'forge-of-the-ancients-h', 'crystal-nest', 'crystal-nest-h', 'land-of-neuren', 'land-of-neuren-h']) {
      expect(applyLevelRules(quest({ categoryId, minLevel: 118, maxLevel: 120 }))).toMatchObject({ minLevel: 118, maxLevel: null });
    }
  });
  it('the boss hunts of those areas stay available too, other boss hunts do not', () => {
    const boss = (name: string) => quest({ categoryId: 'boss-hunt', name, minLevel: 115, maxLevel: 130 });
    for (const n of ['Hunt Primal Golem in Forge of the Ancients', 'Hunt Aragonian in Aragonian\u0027s Lair', 'Hunt Deius in Deius Arena', 'Hunt Dayane in Dayanes Den']) expect(applyLevelRules(boss(n)).maxLevel).toBeNull();
    expect(applyLevelRules(boss('Hunt Ignis in Heart of Fire')).maxLevel).toBe(130);
  });
  it('leaves the quests of other areas alone', () => {
    const q = quest({ categoryId: 'lost-temple', minLevel: 98, maxLevel: 120 });
    expect(applyLevelRules(q)).toBe(q);
  });
});
