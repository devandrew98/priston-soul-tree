import { describe, expect, it } from 'vitest';
import { questGroup } from './groups';

describe('questGroup', () => {
  it('quests that give EXP are leveling', () => {
    expect(questGroup({ baseExp: 7598581 })).toBe('leveling');
  });
  it('EXP 0 is a real value: the quest gives no EXP', () => {
    expect(questGroup({ baseExp: 0 })).toBe('other');
  });
  it('EXP not registered yet is not hidden', () => {
    expect(questGroup({ baseExp: null })).toBe('leveling');
  });
});
