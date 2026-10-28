// Delivery planning: how much EXP is still needed before delivering quests to reach a goal, and in which order to deliver them.
// Works only from the official EXP table; when the table lacks a level the result says so instead of guessing.
// Nothing here touches a character: it always receives a starting position and returns a new one.
import { questReward } from './bonus';
import { addExp, comparePos, expBetween, makeExpTable, pctToState, percentToExp, statePct, type ExpState, type ExpTable } from './exp';
import { isDelivered } from './availability';
import type { BonusChoice, ExpBonus, PlanTarget, Quest, QuestSettings } from './types';

export interface PlanContext {
  table: ExpTable;
  settings: QuestSettings;
  bonuses: ExpBonus[];
  choices: Record<string, BonusChoice>;
}

export const MAX_EXHAUSTIVE = 7; // up to 7 quests every order is tried (5040); above that one sensible order is used

export const makeContext = (rows: Parameters<typeof makeExpTable>[0], settings: QuestSettings, bonuses: ExpBonus[], choices: Record<string, BonusChoice>): PlanContext =>
  ({ table: makeExpTable(rows, settings.expTableMode), settings, bonuses, choices });

/** What a quest gives with the bonuses on (before any per-quest limit rule); null when its base EXP is not registered. */
export function questGain(ctx: PlanContext, quest: Quest): number | null {
  return questReward(quest, ctx.bonuses, ctx.choices, ctx.settings.combineMode, ctx.settings.rounding)?.total ?? null;
}

export interface DeliveryResult { state: ExpState; gain: number; capped: boolean; complete: boolean; missingLevel?: number }

/** Delivers one quest at a position: applies the optional per-quest limit, then adds the EXP crossing levels. */
export function deliver(ctx: PlanContext, state: ExpState, quest: Quest): DeliveryResult | null {
  let gain = questGain(ctx, quest);
  if (gain === null) return null;
  let capped = false;
  const cap = ctx.settings.rules.capPercentPerQuest;
  if (cap !== null) {
    const need = ctx.table.needed(state.level);
    if (need === null) return { state, gain, capped, complete: false, missingLevel: state.level };
    const limit = percentToExp(need, cap);
    if (gain > limit) { gain = limit; capped = true; }
  }
  const r = addExp(ctx.table, state, gain, ctx.settings.rules.overflow);
  return { state: r.state, gain, capped, complete: r.complete, missingLevel: r.missingLevel };
}

export interface PlanStep { quest: Quest; gain: number; capped: boolean; before: ExpState; after: ExpState }

interface Simulation { valid: boolean; reason?: string; steps: PlanStep[]; final: ExpState; complete: boolean; missingLevel?: number }

/** Delivers the quests one after the other from `start`; invalid when a quest cannot be delivered at its turn. */
export function simulateOrder(ctx: PlanContext, start: ExpState, order: Quest[], doneIds: Set<string>): Simulation {
  const steps: PlanStep[] = [];
  const done = new Set(doneIds);
  let state = start;
  for (const q of order) {
    if (q.minLevel !== null && state.level < q.minLevel) return { valid: false, reason: `${q.name}: level ${q.minLevel} necessário`, steps, final: state, complete: true };
    if (q.maxLevel !== null && state.level > q.maxLevel) return { valid: false, reason: `${q.name}: level máximo ${q.maxLevel} ultrapassado`, steps, final: state, complete: true };
    const missing = q.prerequisites.find((id) => !done.has(id));
    if (missing) return { valid: false, reason: `${q.name}: pré-requisito ${missing} não concluído`, steps, final: state, complete: true };
    const d = deliver(ctx, state, q);
    if (!d) return { valid: false, reason: `${q.name}: sem EXP base`, steps, final: state, complete: true };
    steps.push({ quest: q, gain: d.gain, capped: d.capped, before: state, after: d.state });
    state = d.state;
    done.add(q.id);
    if (!d.complete) return { valid: true, steps, final: state, complete: false, missingLevel: d.missingLevel };
  }
  return { valid: true, steps, final: state, complete: true };
}

const natural = (a: Quest, b: Quest) => (a.minLevel ?? 0) - (b.minLevel ?? 0) || a.name.localeCompare(b.name);

/** Every order of the quests in which each quest comes after its prerequisites that are also in the selection. */
export function validOrders(quests: Quest[]): Quest[][] {
  const sorted = [...quests].sort(natural);
  const ids = new Set(sorted.map((q) => q.id));
  const out: Quest[][] = [];
  const used = new Set<string>();
  const cur: Quest[] = [];
  const walk = () => {
    if (cur.length === sorted.length) { out.push([...cur]); return; }
    for (const q of sorted) {
      if (used.has(q.id)) continue;
      if (q.prerequisites.some((p) => ids.has(p) && !used.has(p))) continue;
      used.add(q.id); cur.push(q);
      walk();
      cur.pop(); used.delete(q.id);
    }
  };
  walk();
  return out;
}

/** One reasonable order for long selections: prerequisites first, then by level. */
export function heuristicOrder(quests: Quest[]): Quest[] {
  const sorted = [...quests].sort(natural);
  const ids = new Set(sorted.map((q) => q.id));
  const placed = new Set<string>();
  const out: Quest[] = [];
  while (out.length < sorted.length) {
    const next = sorted.find((q) => !placed.has(q.id) && q.prerequisites.every((p) => !ids.has(p) || placed.has(p)));
    if (!next) break; // a prerequisite loop: the rest cannot be delivered
    placed.add(next.id); out.push(next);
  }
  return out;
}

export type PlanStatus = 'ok' | 'missing_data' | 'unreachable';

export interface PlanResult {
  status: PlanStatus;
  /** First level the EXP table lacks, when status is missing_data. */
  missingLevel?: number;
  /** Selected quests whose base EXP is not registered: left out of every total. */
  skipped: Quest[];
  /** Why the selection cannot be delivered (when status is unreachable). */
  blockedReason?: string;
  totalBase: number;
  totalFinal: number;
  totalExtra: number;
  /** EXP between the starting position and the goal; null when the table lacks a level. */
  needed: number | null;
  /** EXP still to earn by normal leveling before delivering the quests. */
  preGain: number;
  preState: ExpState;
  /** True when the quests alone already reach the goal. */
  alreadyEnough: boolean;
  steps: PlanStep[];
  final: ExpState | null;
  /** EXP above the goal after delivering everything (explains why nothing more is asked). */
  surplus: number | null;
  reachesTarget: boolean;
  orders: { tested: number; valid: number; allEqual: boolean; exhaustive: boolean };
  bestOrderIds: string[];
  /** The worst complete result among the valid orders: when it differs from `final`, the order really matters by that much. */
  worstFinal: ExpState | null;
  targetState: ExpState | null;
}

const empty = (start: ExpState, status: PlanStatus): PlanResult => ({
  status, skipped: [], totalBase: 0, totalFinal: 0, totalExtra: 0, needed: null, preGain: 0, preState: start, alreadyEnough: false,
  steps: [], final: null, surplus: null, reachesTarget: false, orders: { tested: 0, valid: 0, allEqual: true, exhaustive: true }, bestOrderIds: [], worstFinal: null, targetState: null,
});

/** The first level between two positions that the EXP table does not have. */
export function firstMissingLevel(table: ExpTable, from: ExpState, to: ExpState): number | null {
  for (let l = from.level; l < to.level; l++) if (table.needed(l) === null) return l;
  return null;
}

/**
 * Plans the delivery of `quests` from `start` to reach `target` (a level and a percentage of it).
 * Finds the EXP that must still be earned before delivering, tries the possible delivery orders and keeps the best one;
 * when every order gives the same result it says so.
 */
export function planGoal(ctx: PlanContext, start: ExpState, quests: Quest[], target: PlanTarget, doneIds: Set<string>): PlanResult {
  const table = ctx.table;
  const targetState = pctToState(table, target.level, target.pct);
  if (!targetState) return { ...empty(start, 'missing_data'), missingLevel: target.level };
  const need = expBetween(table, start, targetState);
  if (need === null) return { ...empty(start, 'missing_data'), missingLevel: firstMissingLevel(table, start, targetState) ?? start.level, targetState };
  if (table.needed(start.level) === null) return { ...empty(start, 'missing_data'), missingLevel: start.level, targetState };

  const usable = quests.filter((q) => q.baseExp !== null);
  const skipped = quests.filter((q) => q.baseExp === null);
  const gains = usable.map((q) => questGain(ctx, q) as number);
  const totalBase = usable.reduce((a, q) => a + (q.baseExp as number), 0);
  const totalFinal = gains.reduce((a, b) => a + b, 0);

  const exhaustive = usable.length <= MAX_EXHAUSTIVE;
  const orders = exhaustive ? validOrders(usable) : [heuristicOrder(usable)];
  const base = { ...empty(start, 'ok'), skipped, totalBase, totalFinal, totalExtra: totalFinal - totalBase, needed: need, targetState };

  if (usable.length === 0) {
    const pre = addExp(table, start, need, 'carry').state;
    return { ...base, preGain: need, preState: pre, alreadyEnough: need === 0, final: pre, surplus: 0, reachesTarget: true };
  }

  // Best delivery of all the orders from a given starting position.
  const evaluate = (from: ExpState) => {
    let best: Simulation | null = null, bestOrder: Quest[] = [], valid = 0, allEqual = true, firstFinal: ExpState | null = null, worst: ExpState | null = null;
    let firstReason: string | undefined;
    for (const o of orders) {
      const sim = simulateOrder(ctx, from, o, doneIds);
      if (!sim.valid) { firstReason ??= sim.reason; continue; }
      valid++;
      if (!sim.complete) { if (!best) { best = sim; bestOrder = o; } continue; }
      if (firstFinal === null) firstFinal = sim.final; else if (comparePos(firstFinal, sim.final) !== 0) allEqual = false;
      if (worst === null || comparePos(sim.final, worst) < 0) worst = sim.final;
      if (!best || !best.complete || comparePos(sim.final, best.final) > 0) { best = sim; bestOrder = o; }
    }
    return { best, bestOrder, valid, allEqual, firstReason, worst };
  };
  const reaches = (e: number): boolean => {
    const from = addExp(table, start, e, 'carry').state;
    const ev = evaluate(from);
    if (!ev.best) return false;
    // a delivery that runs into a level the table lacks has certainly passed any goal on a lower level
    return ev.best.complete ? comparePos(ev.best.final, targetState) >= 0 : ev.best.final.level > targetState.level;
  };

  // The EXP to earn first. Without limit rules the final position is start + earned + rewards, so it is a subtraction.
  const simple = ctx.settings.rules.capPercentPerQuest === null && ctx.settings.rules.overflow === 'carry';
  let pre = Math.max(0, need - totalFinal);
  if (!simple || !reaches(pre)) {
    if (!reaches(need)) {
      const ev = evaluate(start);
      const reason = ev.valid === 0 ? ev.firstReason ?? 'nenhuma ordem de entrega é possível' : 'as regras de level e de EXP das quests impedem de chegar ao objetivo';
      return { ...base, status: 'unreachable', blockedReason: reason, orders: { tested: orders.length, valid: ev.valid, allEqual: ev.allEqual, exhaustive } };
    }
    let lo = 0, hi = need; // smallest e that reaches the goal (hi always does)
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (reaches(mid)) hi = mid; else lo = mid + 1;
    }
    pre = lo;
  }

  const preState = addExp(table, start, pre, 'carry').state;
  const ev = evaluate(preState);
  const best = ev.best as Simulation;
  const final = best.final;
  const reached = best.complete ? comparePos(final, targetState) >= 0 : final.level > targetState.level;
  const surplus = reached ? expBetween(table, targetState, final) : 0;
  return {
    ...base,
    status: best.complete ? 'ok' : 'missing_data',
    missingLevel: best.complete ? undefined : best.missingLevel,
    preGain: pre,
    preState,
    alreadyEnough: pre === 0 && reached,
    steps: best.steps,
    final,
    surplus,
    reachesTarget: reached,
    orders: { tested: orders.length, valid: ev.valid, allEqual: ev.allEqual, exhaustive },
    bestOrderIds: ev.bestOrder.map((q) => q.id),
    worstFinal: ev.worst,
  };
}

/** The quests a character has already delivered at least once (used as the starting point for prerequisites). */
export const deliveredIds = (progress: Record<string, Parameters<typeof isDelivered>[0]>): Set<string> =>
  new Set(Object.entries(progress).filter(([, p]) => isDelivered(p)).map(([id]) => id));

/** "level 70 · 12.34%" style position, or null when the table lacks the level. */
export const positionPct = (table: ExpTable, s: ExpState): number | null => statePct(table, s);
