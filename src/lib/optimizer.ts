import type { Inventory, Rarity, SlotState, Category } from './types';
import { SOULS } from './souls';
import {
  TREE_NODES,
  TREE_NODE_BY_ID,
  NODE_CATEGORY,
  RARITY_POINT_COST,
  RARITY_ORDER,
  acceptsSoul,
} from './tree';
import { nodeFinalValue } from './formula';

// No fixed per-node cap: the real limit is the fusion points budget. This high
// value only guards the "no budget" case from looping forever.
const SAFETY_LEVEL_CAP = 999;

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
  score: number; // weighted score contributed by this node
  points: number;
}

export interface OptimizeResult {
  slots: Record<string, SlotState>;
  used: PlacedNode[];
  totalScore: number;
  pointsSpent: number;
}

/** A weighted stat a soul contributes toward the current goal. */
interface WStat {
  weight: number;
  base: number;
}

interface Candidate {
  soulId: string;
  category: Category;
  rarity: Rarity;
  soulLevel: 1 | 2 | 3;
  stats: WStat[]; // only stats the goal cares about
  weightBase: number; // Σ weight*base at node level 1 — the value of just placing it
}

interface NodeAssignment {
  slotId: string;
  soulId: string;
  soulLevel: 1 | 2 | 3;
  rarity: Rarity;
  stats: WStat[];
  level: number;
}

function emptySlots(): Record<string, SlotState> {
  const s: Record<string, SlotState> = {};
  for (const def of TREE_NODES) {
    s[def.id] = { soulId: null, soulLevel: 1, nodeLevel: 1 };
  }
  return s;
}

/** Weighted score of a set of stats on a node of the given rarity/level. */
function scoreAt(stats: WStat[], rarity: Rarity, level: number): number {
  let s = 0;
  for (const st of stats) s += st.weight * nodeFinalValue(st.base, rarity, level);
  return s;
}

/**
 * Build the best possible build for a goal using only owned souls.
 *
 * Each node has a FIXED rarity (multiplier, cost-per-level). We spend the fusion
 * points budget with ONE unified greedy: at every step the next point either
 *   - PLACES an unused soul on the cheapest acceptable free node (gain = its
 *     base value, so two-attribute souls count both stats), or
 *   - LEVELS an already-placed node (gain = the marginal value of +1 level),
 * whichever buys the most score per point. This fills the rarer nodes instead of
 * over-levelling a single common node, and never exceeds the budget.
 */
export function optimize(goal: Goal, inv: Inventory, opt: OptimizeOptions): OptimizeResult {
  const budget = opt.budget ?? Infinity;

  // Candidate souls from inventory that contribute at least one targeted stat.
  const candidates: Candidate[] = [];
  for (const soul of SOULS) {
    const owned = inv[soul.id];
    if (!owned) continue;
    if (soul.category === 'pvp' && !goal.includePvp) continue;
    const stats: WStat[] = [];
    let weightBase = 0;
    for (const st of soul.stats) {
      const w = goal.weights[st.stat];
      if (!w) continue;
      const base = st.ranks[owned - 1];
      stats.push({ weight: w, base });
      weightBase += w * base;
    }
    if (stats.length === 0) continue;
    candidates.push({ soulId: soul.id, category: soul.category, rarity: soul.rarity, soulLevel: owned, stats, weightBase });
  }
  candidates.sort((a, b) => b.weightBase - a.weightBase);

  const slots = emptySlots();
  const freeNodes = new Set(TREE_NODES.map((n) => n.id));
  const placed: NodeAssignment[] = [];
  let spent = 0;

  // Highest-rarity acceptable free node for a soul (tie-break to the cheaper one).
  const bestNodeFor = (c: Candidate): string | null => {
    let bestId: string | null = null;
    let bestOrder = -1;
    let bestCost = Infinity;
    for (const id of freeNodes) {
      const n = TREE_NODE_BY_ID[id];
      if (!acceptsSoul(NODE_CATEGORY[n.type], n.rarity, c.category, c.rarity)) continue;
      const ord = RARITY_ORDER[n.rarity];
      const cost = RARITY_POINT_COST[n.rarity];
      if (ord > bestOrder || (ord === bestOrder && cost < bestCost)) {
        bestId = id;
        bestOrder = ord;
        bestCost = cost;
      }
    }
    return bestId;
  };

  // Phase 1 — FILL: place souls (strongest first) on the highest-rarity node they
  // qualify for, so the rare/legendary nodes actually get used. Level 1 each.
  for (const c of candidates) {
    const nodeId = bestNodeFor(c);
    if (nodeId === null) continue;
    const n = TREE_NODE_BY_ID[nodeId];
    const cost = RARITY_POINT_COST[n.rarity];
    if (spent + cost > budget) continue;
    freeNodes.delete(nodeId);
    placed.push({ slotId: nodeId, soulId: c.soulId, soulLevel: c.soulLevel, rarity: n.rarity, stats: c.stats, level: 1 });
    spent += cost;
  }

  // Phase 2 — LEVEL: spend the rest where each extra point buys the most score.
  for (;;) {
    let best: NodeAssignment | null = null;
    let bestEff = 0;
    let bestCost = 0;
    for (const a of placed) {
      if (a.level >= SAFETY_LEVEL_CAP) continue;
      const cost = RARITY_POINT_COST[a.rarity];
      if (cost > budget - spent) continue;
      const gain = scoreAt(a.stats, a.rarity, a.level + 1) - scoreAt(a.stats, a.rarity, a.level);
      const eff = gain / cost;
      if (eff > bestEff) { bestEff = eff; best = a; bestCost = cost; }
    }
    if (!best) break;
    best.level += 1;
    spent += bestCost;
  }

  // Materialize result.
  const used: PlacedNode[] = [];
  let totalScore = 0;
  for (const a of placed) {
    const score = scoreAt(a.stats, a.rarity, a.level);
    const points = RARITY_POINT_COST[a.rarity] * a.level;
    slots[a.slotId] = { soulId: a.soulId, soulLevel: a.soulLevel, nodeLevel: a.level };
    used.push({ soulId: a.soulId, slotId: a.slotId, nodeRarity: a.rarity, nodeLevel: a.level, score, points });
    totalScore += score;
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
