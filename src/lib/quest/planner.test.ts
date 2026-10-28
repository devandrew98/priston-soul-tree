import { describe, expect, it } from 'vitest';
import { addExp, statePct } from './exp';
import { MAX_EXHAUSTIVE, makeContext, planGoal, simulateOrder, validOrders, type PlanContext } from './planner';
import { DEFAULT_SETTINGS, type ExpBonus, type ExpLevel, type Quest, type QuestSettings } from './types';

// Made-up numbers, only for the tests (they are NOT game values).
const levels = (values: Record<number, number>): ExpLevel[] => Object.entries(values).map(([level, value]) => ({ level: Number(level), value, active: true }));
const ROWS = levels({ 68: 1000, 69: 2000, 70: 3000, 71: 4000, 72: 5000 });
const potion: ExpBonus = { id: 'potion', name: 'Potion', kind: 'toggle', percent: 30, enabled: true, appliesTo: ['normal', 'boss'], sort: 1, builtin: true };

const quest = (id: string, baseExp: number | null, over: Partial<Quest> = {}): Quest => ({
  id, name: id, categoryId: 'normal', minLevel: null, maxLevel: null, map: '', npc: '', description: '', objectives: [], baseExp,
  prerequisites: [], repeatType: 'once', repeatIntervalHours: null, active: true, archived: false, ...over,
});
const ctxWith = (settings: Partial<QuestSettings> = {}, on = false): PlanContext =>
  makeContext(ROWS, { ...DEFAULT_SETTINGS, ...settings, rules: { ...DEFAULT_SETTINGS.rules, ...settings.rules } }, [potion], on ? { potion: { on: true } } : {});
const none = new Set<string>();
const addTo = (ctx: PlanContext, gain: number) => addExp(ctx.table, { level: 69, exp: 1900 }, gain).state;

describe('planGoal: the example of the brief', () => {
  it('level 69 at 40%, a quest worth 14% of the level, goal level 70 at 0%: earn up to 86% first', () => {
    const ctx = ctxWith();
    const start = { level: 69, exp: 800 }; // 40% of 2000
    const r = planGoal(ctx, start, [quest('q', 280)], { level: 70, pct: 0 }, none);
    expect(r.status).toBe('ok');
    expect(r.needed).toBe(1200);
    expect(r.preGain).toBe(920); // 46 percentage points of 2000
    expect(statePct(ctx.table, r.preState)).toBeCloseTo(86, 10);
    expect(r.final).toEqual({ level: 70, exp: 0 });
    expect(r.reachesTarget).toBe(true);
    expect(r.alreadyEnough).toBe(false);
  });
  it('already enough: delivering now reaches the goal and the surplus is explained', () => {
    const r = planGoal(ctxWith(), { level: 69, exp: 1900 }, [quest('q', 500)], { level: 70, pct: 0 }, none);
    expect(r.preGain).toBe(0);
    expect(r.alreadyEnough).toBe(true);
    expect(r.final).toEqual({ level: 70, exp: 400 });
    expect(r.surplus).toBe(400);
  });
});

describe('planGoal: several quests and bonuses', () => {
  it('sums the final EXP with the bonuses on', () => {
    const r = planGoal(ctxWith({}, true), { level: 69, exp: 0 }, [quest('a', 1000), quest('b', 1000)], { level: 70, pct: 0 }, none);
    expect(r.totalBase).toBe(2000);
    expect(r.totalFinal).toBe(2600);
    expect(r.totalExtra).toBe(600);
    expect(r.preGain).toBe(0); // 2600 >= 2000
    expect(r.final).toEqual({ level: 70, exp: 600 });
  });
  it('goal Level 120-style with a percentage: level 70 at 25% (750 of 3000)', () => {
    const r = planGoal(ctxWith(), { level: 69, exp: 1000 }, [quest('a', 600), quest('b', 400)], { level: 70, pct: 25 }, none);
    // from level 69 with 1000: need (2000-1000) + 750 = 1750; quests give 1000 -> earn 750 first
    expect(r.needed).toBe(1750);
    expect(r.preGain).toBe(750);
    expect(r.reachesTarget).toBe(true);
    expect(r.final).toEqual({ level: 70, exp: 750 });
  });
  it('multiple levels in one delivery', () => {
    const r = planGoal(ctxWith(), { level: 69, exp: 0 }, [quest('a', 6000)], { level: 71, pct: 0 }, none);
    expect(r.final).toEqual({ level: 71, exp: 1000 });
    expect(r.surplus).toBe(1000);
  });
  it('skips quests without a registered base EXP and says so', () => {
    const r = planGoal(ctxWith(), { level: 69, exp: 0 }, [quest('a', 500), quest('x', null)], { level: 70, pct: 0 }, none);
    expect(r.skipped.map((q) => q.id)).toEqual(['x']);
    expect(r.totalBase).toBe(500);
  });
  it('no quests: the whole difference is leveling', () => {
    const r = planGoal(ctxWith(), { level: 69, exp: 500 }, [], { level: 70, pct: 0 }, none);
    expect(r.preGain).toBe(1500);
    expect(r.final).toEqual({ level: 70, exp: 0 });
  });
  it('a goal already behind the character needs nothing', () => {
    const r = planGoal(ctxWith(), { level: 71, exp: 0 }, [quest('a', 100)], { level: 70, pct: 50 }, none);
    expect(r.needed).toBe(0);
    expect(r.preGain).toBe(0);
    expect(r.alreadyEnough).toBe(true);
  });
});

describe('planGoal: missing data is reported, never invented', () => {
  it('a goal level missing from the table', () => {
    const r = planGoal(ctxWith(), { level: 69, exp: 0 }, [quest('a', 100)], { level: 90, pct: 10 }, none);
    expect(r.status).toBe('missing_data');
    expect(r.missingLevel).toBe(90);
  });
  it('a level in between missing from the table', () => {
    const r = planGoal(ctxWith(), { level: 69, exp: 0 }, [quest('a', 100)], { level: 75, pct: 0 }, none);
    expect(r.status).toBe('missing_data');
    expect(r.missingLevel).toBe(73);
  });
  it('the starting level missing', () => {
    expect(planGoal(ctxWith(), { level: 200, exp: 0 }, [], { level: 201, pct: 0 }, none).status).toBe('missing_data');
  });
  it('deliveries that run out of the table', () => {
    const r = planGoal(ctxWith(), { level: 72, exp: 4900 }, [quest('a', 500)], { level: 72, pct: 50 }, none);
    expect(r.status).toBe('missing_data');
    expect(r.missingLevel).toBe(73);
  });
});

describe('delivery order', () => {
  it('without rules every valid order gives the same EXP and it says so', () => {
    const r = planGoal(ctxWith(), { level: 69, exp: 0 }, [quest('a', 700), quest('b', 900), quest('c', 1200)], { level: 70, pct: 0 }, none);
    expect(r.orders.exhaustive).toBe(true);
    expect(r.orders.tested).toBe(6);
    expect(r.orders.allEqual).toBe(true);
  });
  it('prerequisites inside the selection fix the order', () => {
    const a = quest('a', 100), b = quest('b', 100, { prerequisites: ['a'] });
    const orders = validOrders([b, a]);
    expect(orders).toHaveLength(1);
    expect(orders[0].map((q) => q.id)).toEqual(['a', 'b']);
    expect(planGoal(ctxWith(), { level: 69, exp: 0 }, [b, a], { level: 69, pct: 10 }, none).bestOrderIds).toEqual(['a', 'b']);
  });
  it('a prerequisite that is neither done nor selected blocks the plan', () => {
    const r = planGoal(ctxWith(), { level: 69, exp: 0 }, [quest('b', 100, { prerequisites: ['zzz'] })], { level: 69, pct: 5 }, none);
    expect(r.status).toBe('unreachable');
    expect(r.blockedReason).toMatch(/pré-requisito/);
    expect(planGoal(ctxWith(), { level: 69, exp: 0 }, [quest('b', 100, { prerequisites: ['zzz'] })], { level: 69, pct: 5 }, new Set(['zzz'])).status).toBe('ok');
  });
  it('a limit rule makes the order matter, and the best order is found (and shown to be better)', () => {
    // cap: a quest gives at most 50% of the EXP of the level it is delivered in.
    // Level 69 needs 2000 (cap 1000), level 70 needs 3000 (cap 1500).
    const ctx = ctxWith({ rules: { capPercentPerQuest: 50, overflow: 'carry' } });
    const big = quest('big', 5000), small = quest('small', 500);
    const r = planGoal(ctx, { level: 69, exp: 1900 }, [big, small], { level: 70, pct: 0 }, none);
    expect(r.preGain).toBe(0);
    expect(r.orders.allEqual).toBe(false);
    // delivering "small" first (+500 -> level 70 with 400) lets "big" be capped at 1500 instead of 1000
    expect(r.bestOrderIds).toEqual(['small', 'big']);
    const worse = simulateOrder(ctx, { level: 69, exp: 1900 }, [big, small], none);
    const better = simulateOrder(ctx, { level: 69, exp: 1900 }, [small, big], none);
    expect(better.final.level * 1e9 + better.final.exp).toBeGreaterThan(worse.final.level * 1e9 + worse.final.exp);
    expect(r.final).toEqual(better.final);
    expect(r.worstFinal).toEqual(worse.final); // the difference is shown with real numbers
  });
  it('with a limit rule the EXP to earn first can be smaller than the plain subtraction would say, never wrong', () => {
    const ctx = ctxWith({ rules: { capPercentPerQuest: 50, overflow: 'carry' } });
    const r = planGoal(ctx, { level: 69, exp: 1900 }, [quest('big', 5000), quest('small', 500)], { level: 71, pct: 0 }, none);
    expect(r.reachesTarget).toBe(true);
    expect(r.preGain).toBe(1100);
    // one EXP less is not enough (the search found the real minimum)
    const less = planGoal(ctx, addTo(ctx, 1099), [quest('big', 5000), quest('small', 500)], { level: 71, pct: 0 }, none);
    expect(less.preGain).toBeGreaterThan(0);
  });
  it('over 7 quests one reasonable order is used, not every permutation', () => {
    const many = Array.from({ length: MAX_EXHAUSTIVE + 1 }, (_, i) => quest(`q${i}`, 100));
    const r = planGoal(ctxWith(), { level: 69, exp: 0 }, many, { level: 69, pct: 20 }, none);
    expect(r.orders.exhaustive).toBe(false);
    expect(r.orders.tested).toBe(1);
  });
});

describe('level restrictions at delivery', () => {
  it('a quest that needs a higher level can only be delivered after levelling up', () => {
    const q = quest('lvl', 300, { minLevel: 70 });
    const r = planGoal(ctxWith(), { level: 69, exp: 0 }, [q], { level: 70, pct: 10 }, none);
    // needs 2000 (to 70) + 300 = 2300; the quest alone cannot be delivered at 69, so it must come after reaching level 70
    expect(r.status).toBe('ok');
    expect(r.reachesTarget).toBe(true);
    expect(r.steps[0].before.level).toBeGreaterThanOrEqual(70);
  });
  it('a quest past its maximum level makes the goal unreachable', () => {
    const q = quest('old', 300, { maxLevel: 69 });
    const r = planGoal(ctxWith(), { level: 69, exp: 1900 }, [q], { level: 71, pct: 0 }, none);
    expect(r.status).toBe('unreachable');
  });
});

describe('overflow rule', () => {
  it('"lose" drops the EXP above the level-up point of a delivery', () => {
    const ctx = ctxWith({ rules: { capPercentPerQuest: null, overflow: 'lose' } });
    const d = simulateOrder(ctx, { level: 69, exp: 1500 }, [quest('a', 1000)], none);
    expect(d.final).toEqual({ level: 70, exp: 0 });
  });
  it('the same delivery carries the rest by default', () => {
    expect(addExp(ctxWith().table, { level: 69, exp: 1500 }, 1000).state).toEqual({ level: 70, exp: 500 });
  });
});

describe('the real progress is never touched', () => {
  it('planGoal does not modify its inputs', () => {
    const start = { level: 69, exp: 800 };
    const qs = [quest('a', 280)];
    const done = new Set(['x']);
    planGoal(ctxWith({}, true), start, qs, { level: 70, pct: 0 }, done);
    expect(start).toEqual({ level: 69, exp: 800 });
    expect(qs[0].baseExp).toBe(280);
    expect([...done]).toEqual(['x']);
  });
});
