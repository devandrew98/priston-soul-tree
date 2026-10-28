import { describe, expect, it } from 'vitest';
import { activeBonuses, applyBonuses, compareBonusSets, configuredTotal, questReward } from './bonus';
import type { ExpBonus, Quest } from './types';

// Made-up bonuses and quests, only for the tests.
const bonuses: ExpBonus[] = [
  { id: 'potion', name: 'EXP Potion', kind: 'toggle', percent: 30, enabled: true, appliesTo: ['normal', 'boss'], sort: 1, builtin: true },
  { id: 'world', name: 'World Buff', kind: 'toggle', percent: 5, enabled: true, appliesTo: ['normal', 'boss'], sort: 2, builtin: true },
  { id: 'honey', name: 'Fast Honey', kind: 'toggle', percent: 10, enabled: true, appliesTo: ['normal', 'boss'], sort: 3, builtin: true },
  { id: 'soul', name: 'Soul Tree', kind: 'manual', percent: 0, enabled: true, appliesTo: ['normal', 'boss'], sort: 4, builtin: true },
];
const quest = (over: Partial<Quest> = {}): Quest => ({
  id: 'q', name: 'Q', categoryId: 'normal', minLevel: null, maxLevel: null, map: '', npc: '', description: '', objectives: [], baseExp: 1000,
  prerequisites: [], repeatType: 'once', repeatIntervalHours: null, active: true, archived: false, ...over,
});

describe('applyBonuses', () => {
  const all = [{ id: 'a', name: 'A', percent: 30 }, { id: 'b', name: 'B', percent: 5 }, { id: 'c', name: 'C', percent: 8 }];
  it('additive: +43% on 1000 = 1430', () => {
    const r = applyBonuses(1000, all, 'additive', 'floor');
    expect(r.total).toBe(1430);
    expect(r.extra).toBe(430);
    expect(r.effectivePercent).toBeCloseTo(43, 10);
  });
  it('multiplicative: 1.3 x 1.05 x 1.08 on 1000 = 1474.2 -> 1474', () => {
    expect(applyBonuses(1000, all, 'multiplicative', 'floor').total).toBe(1474);
    expect(applyBonuses(1000, all, 'multiplicative', 'ceil').total).toBe(1475);
  });
  it('the two formulas really differ, so the choice matters', () => {
    expect(applyBonuses(1_000_000, all, 'additive', 'floor').total).not.toBe(applyBonuses(1_000_000, all, 'multiplicative', 'floor').total);
  });
  it('rounds once at the end', () => {
    expect(applyBonuses(7, [{ id: 'a', name: 'A', percent: 10 }], 'additive', 'floor').total).toBe(7);   // 7.7
    expect(applyBonuses(7, [{ id: 'a', name: 'A', percent: 10 }], 'additive', 'round').total).toBe(8);
    expect(applyBonuses(7, [{ id: 'a', name: 'A', percent: 10 }], 'additive', 'ceil').total).toBe(8);
  });
  it('no bonuses: the base', () => {
    expect(applyBonuses(1234, [], 'additive', 'floor')).toMatchObject({ total: 1234, extra: 0, effectivePercent: 0 });
  });
  it('is exact for big values with decimals', () => {
    expect(applyBonuses(9_000_000_000_000, [{ id: 'a', name: 'A', percent: 33.33 }], 'additive', 'floor').total).toBe(11_999_700_000_000);
  });
});

describe('activeBonuses', () => {
  it('a toggle uses the administrator percentage, a manual one the player', () => {
    const list = activeBonuses('normal', bonuses, { potion: { on: true }, world: { on: false }, soul: { on: true, percent: 8 } });
    expect(list.map((b) => [b.id, b.percent])).toEqual([['potion', 30], ['soul', 8]]);
  });
  it('only the categories the bonus applies to', () => {
    expect(activeBonuses('daily', bonuses, { potion: { on: true } })).toEqual([]);
    expect(activeBonuses('boss', bonuses, { potion: { on: true } })).toHaveLength(1);
  });
  it('a bonus the administrator turned off never applies', () => {
    const off = bonuses.map((b) => (b.id === 'potion' ? { ...b, enabled: false } : b));
    expect(activeBonuses('normal', off, { potion: { on: true } })).toEqual([]);
  });
  it('an empty appliesTo means every category', () => {
    const any = bonuses.map((b) => ({ ...b, appliesTo: [] }));
    expect(activeBonuses('special', any, { potion: { on: true } })).toHaveLength(1);
  });
  it('a manual percentage is kept in a sane range', () => {
    expect(activeBonuses('normal', bonuses, { soul: { on: true, percent: -5 } })).toEqual([]);
    expect(activeBonuses('normal', bonuses, { soul: { on: true, percent: 99999 } })[0].percent).toBe(1000);
  });
});

describe('configuredTotal / questReward', () => {
  it('the example of the brief: potion + world + soul 8% = +43% (additive)', () => {
    expect(configuredTotal(bonuses, { potion: { on: true }, world: { on: true }, soul: { on: true, percent: 8 } }, 'additive')).toBe(43);
  });
  it('questReward is null without a registered base EXP', () => {
    expect(questReward(quest({ baseExp: null }), bonuses, {}, 'additive', 'floor')).toBeNull();
    expect(questReward(quest(), bonuses, { potion: { on: true } }, 'additive', 'floor')?.total).toBe(1300);
  });
});

describe('compareBonusSets', () => {
  const choices = { potion: { on: true }, world: { on: true }, honey: { on: true }, soul: { on: true, percent: 8 } };
  it('none, then each bonus added in order', () => {
    const rows = compareBonusSets([quest()], bonuses, choices, 'additive', 'floor');
    expect(rows.map((r) => r.total)).toEqual([1000, 1300, 1350, 1450, 1530]);
    expect(rows[4].names).toEqual(['EXP Potion', 'World Buff', 'Fast Honey', 'Soul Tree']);
    expect(rows[4].extraVsNone).toBe(530);
    expect(rows[4].extraVsNonePct).toBeCloseTo(53, 10);
    expect(rows[3].extraVsPrev).toBe(100);
  });
  it('works for several quests and skips the ones without base EXP', () => {
    const rows = compareBonusSets([quest(), quest({ id: 'b', baseExp: 500 }), quest({ id: 'c', baseExp: null })], bonuses, choices, 'additive', 'floor');
    expect(rows[0].total).toBe(1500);
    expect(rows[1].total).toBe(1950);
  });
  it('bonuses the player did not turn on are not in the comparison', () => {
    const rows = compareBonusSets([quest()], bonuses, { potion: { on: true } }, 'additive', 'floor');
    expect(rows.map((r) => r.total)).toEqual([1000, 1300]);
  });
});
