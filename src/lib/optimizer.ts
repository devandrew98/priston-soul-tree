import type { Inventory, Rarity, SlotState, Category } from './types';
import { SOULS } from './souls';
import {
  TREE_NODES,
  TREE_NODE_BY_ID,
  NODE_CATEGORY,
  RARITY_POINT_COST,
  RARITY_ORDER,
  MAX_NODE_LEVEL,
  acceptsSoul,
} from './tree';
import { nodeFinalValue } from './formula';

export interface Goal {
  id: string;
  name: string;
  /** stat key -> weight (relative importance). Only stats present here are targeted. */
  weights: Record<string, number>;
  /** include PvP souls/slots in the optimization */
  includePvp?: boolean;
  custom?: boolean;
}

export interface OptimizeOptions {
  budget?: number; // max fusion points to spend (optional)
}

export interface PlacedNode {
  soulId: string;
  slotId: string;
  nodeRarity: Rarity;
  nodeLevel: number;
  value: number;
  points: number;
}

export interface OptimizeResult {
  slots: Record<string, SlotState>;
  used: PlacedNode[];
  totalScore: number;
  pointsSpent: number;
}

interface Candidate {
  soulId: string;
  category: Category;
  rarity: Rarity;
  weight: number;
  base: number;
  soulLevel: 1 | 2 | 3;
}

interface NodeAssignment {
  slotId: string;
  soulId: string;
  soulLevel: 1 | 2 | 3;
  rarity: Rarity;
  weight: number;
  base: number;
  level: number;
}

function emptySlots(): Record<string, SlotState> {
  const s: Record<string, SlotState> = {};
  for (const def of TREE_NODES) {
    s[def.id] = { soulId: null, soulLevel: 1, nodeLevel: 1 };
  }
  return s;
}

/**
 * Build the best possible build for a goal using only owned souls.
 *
 * Each node has a FIXED rarity (multiplier, cost-per-level and max level).
 * Strategy:
 *  1. Assignment — place the strongest souls (by weight x base) onto the
 *     cheapest acceptable free node, respecting category + rarity rules and the
 *     point budget. Every placed node starts at level 1.
 *  2. Point allocation — repeatedly spend a point where it buys the most score
 *     (highest extra-score / extra-cost), respecting per-rarity max levels,
 *     until the budget is exhausted. The Fusion formula has diminishing returns,
 *     so this spreads points sensibly across nodes.
 */
export function optimize(goal: Goal, inv: Inventory, opt: OptimizeOptions): OptimizeResult {
  const budget = opt.budget ?? Infinity;

  // Candidate souls from inventory targeting the goal's stats.
  const candidates: Candidate[] = [];
  for (const soul of SOULS) {
    const owned = inv[soul.id];
    if (!owned) continue;
    if (soul.category === 'pvp' && !goal.includePvp) continue;
    const w = goal.weights[soul.stat];
    if (!w) continue;
    candidates.push({
      soulId: soul.id,
      category: soul.category,
      rarity: soul.rarity,
      weight: w,
      base: soul.ranks[owned - 1],
      soulLevel: owned,
    });
  }
  // Strongest souls first (value at node level 1 is just the base value).
  candidates.sort((a, b) => b.weight * b.base - a.weight * a.base);

  const slots = emptySlots();
  const assignments: NodeAssignment[] = [];
  const freeNodes = new Set(TREE_NODES.map((n) => n.id));
  let spent = 0;

  // 1) Assignment: cheapest acceptable free node per soul, within budget.
  for (const c of candidates) {
    let bestId: string | null = null;
    let bestCost = Infinity;
    for (const id of freeNodes) {
      const n = TREE_NODE_BY_ID[id];
      if (!acceptsSoul(NODE_CATEGORY[n.type], n.rarity, c.category, c.rarity)) continue;
      const cost = RARITY_POINT_COST[n.rarity];
      if (spent + cost > budget) continue;
      // cheapest node; tie-break to the lower-rarity node (saves rarer nodes).
      if (cost < bestCost || (cost === bestCost && (bestId === null || RARITY_ORDER[n.rarity] < RARITY_ORDER[TREE_NODE_BY_ID[bestId].rarity]))) {
        bestId = id;
        bestCost = cost;
      }
    }
    if (bestId === null) continue;
    const n = TREE_NODE_BY_ID[bestId];
    spent += bestCost;
    freeNodes.delete(bestId);
    assignments.push({
      slotId: bestId,
      soulId: c.soulId,
      soulLevel: c.soulLevel,
      rarity: n.rarity,
      weight: c.weight,
      base: c.base,
      level: 1,
    });
  }

  // 2) Point allocation by marginal score-per-point.
  let remaining = budget === Infinity ? Infinity : budget - spent;
  for (;;) {
    let best: NodeAssignment | null = null;
    let bestEff = 0;
    let bestCost = 0;
    for (const a of assignments) {
      if (a.level >= MAX_NODE_LEVEL[a.rarity]) continue;
      const dCost = RARITY_POINT_COST[a.rarity];
      if (dCost > remaining) continue;
      const cur = nodeFinalValue(a.base, a.rarity, a.level);
      const nxt = nodeFinalValue(a.base, a.rarity, a.level + 1);
      const eff = (a.weight * (nxt - cur)) / dCost;
      if (eff > bestEff) {
        bestEff = eff;
        best = a;
        bestCost = dCost;
      }
    }
    if (!best) break;
    best.level += 1;
    remaining -= bestCost;
    spent += bestCost;
  }

  // Materialize result.
  const used: PlacedNode[] = [];
  let totalScore = 0;
  for (const a of assignments) {
    const value = nodeFinalValue(a.base, a.rarity, a.level);
    const points = RARITY_POINT_COST[a.rarity] * a.level;
    slots[a.slotId] = { soulId: a.soulId, soulLevel: a.soulLevel, nodeLevel: a.level };
    used.push({ soulId: a.soulId, slotId: a.slotId, nodeRarity: a.rarity, nodeLevel: a.level, value, points });
    totalScore += a.weight * value;
  }

  return { slots, used, totalScore, pointsSpent: spent };
}

export const PRESET_GOALS: Goal[] = [
  { id: 'attack-power', name: 'Full Attack Power', weights: { attackPower: 1 } },
  { id: 'attack-rating', name: 'Full Attack Rating', weights: { attackRating: 1 } },
  { id: 'crit', name: 'Critical Rate', weights: { critRate: 1 } },
  { id: 'exp', name: 'EXP / Farm', weights: { exp: 1 } },
  {
    id: 'sod',
    name: 'SoD (Attack focus)',
    weights: { attackPower: 1, attackRating: 0.5, critRate: 30 },
  },
  {
    id: 'tank',
    name: 'Tank / Defense',
    weights: { defense: 1, absorb: 3, hp: 1, block: 40 },
  },
  {
    id: 'support',
    name: 'Support (Mana/Speed)',
    weights: { mana: 1, moveSpeed: 10, stamina: 0.5 },
  },
  {
    id: '1v1',
    name: '1v1 PvP',
    weights: { attackPower: 1, attackRating: 0.5, defense: 1, absorb: 3, evade: 40, critRate: 30 },
    includePvp: true,
  },
];
