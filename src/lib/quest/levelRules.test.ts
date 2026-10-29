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
  it('leaves the quests of other areas alone', () => {
    const q = quest({ categoryId: 'crystal-nest', minLevel: 118, maxLevel: 150 });
    expect(applyLevelRules(q)).toBe(q);
  });
});
