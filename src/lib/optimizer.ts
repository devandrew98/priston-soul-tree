import type { Inventory, Rarity, SlotState, Category } from './types';
import { SOULS } from './souls';
import {
  TREE_NODES,
  TREE_NODE_BY_ID,
  NODE_CATEGORY,
  RARITY_POINT_COST,
  acceptsSoul,
  pvpSoulKind,
  type PvpKind,
} from './tree';
import { ROOT_NODE, reachAll, unlockCost } from './graph';
import { nodeFinalValue, MAX_FUSION_POINTS } from './formula';

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
  /** use ONLY PvP souls (for pure-PvP builds) */
  pvpOnly?: boolean;
  custom?: boolean;
}

export interface OptimizeOptions {
  budget?: number; // max fusion points to spend (optional)
  allSouls?: boolean; // consider every soul (at level 3), not just the owned ones
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
  pvpKind: PvpKind | null;
  soulLevel: 1 | 2 | 3;
  stats: WStat[]; // only stats the goal cares about
  weightBase: number; // Σ weight*base at node level 1 — value of just placing it
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
 * Build the best possible build for a goal using only owned souls, respecting the
 * game's UNLOCK rules: every used node must be opened, you can only open a node
 * connected to the top, and opening any node (even empty pass-through ones) costs
 * its rarity price. We spend the fusion points budget with one unified greedy:
 * at each step the next points either
 *   - REACH a free node from the top and place an unused soul there (paying the
 *     unlock cost of every still-locked node on the cheapest path), or
 *   - LEVEL an already-placed node (gain = the marginal value of +1 level),
 * whichever buys the most score per point.
 */
export function optimize(goal: Goal, inv: Inventory, opt: OptimizeOptions): OptimizeResult {
  // Hard game cap: no build may ever spend more than 217 fusion points.
  const budget = Math.min(opt.budget ?? MAX_FUSION_POINTS, MAX_FUSION_POINTS);

  const candidates: Candidate[] = [];
  for (const soul of SOULS) {
    const owned = opt.allSouls ? 3 : inv[soul.id];
    if (!owned) continue;
    if (goal.pvpOnly && soul.category !== 'pvp') continue;
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
    candidates.push({ soulId: soul.id, category: soul.category, rarity: soul.rarity, pvpKind: pvpSoulKind(soul), soulLevel: owned, stats, weightBase });
  }
  candidates.sort((a, b) => b.weightBase - a.weightBase);

  const slots = emptySlots();
  const unlocked = new Set<string>();
  const souledNodes = new Set<string>();
  const placedSouls = new Set<string>();
  const placed: NodeAssignment[] = [];
  let spent = 0;

  // Open the top node first — nothing can be reached without it.
  if (candidates.length) {
    unlocked.add(ROOT_NODE);
    spent += unlockCost(ROOT_NODE);
  }

  for (;;) {
    const rem = budget - spent;
    if (rem <= 0) break;
    const { dist, prev } = reachAll(unlocked);

    let bestEff = 0;
    let bestCost = 0;
    let placeMove: { c: Candidate; nodeId: string } | null = null;
    let levelMove: NodeAssignment | null = null;

    // Option A: reach a free node from the top and place an unused soul there.
    for (const c of candidates) {
      if (placedSouls.has(c.soulId)) continue;
      let bestNode: string | null = null;
      let bestNodeCost = Infinity;
      for (const n of TREE_NODES) {
        if (souledNodes.has(n.id)) continue;
        if (!acceptsSoul(NODE_CATEGORY[n.type], n.rarity, c.category, c.rarity, n.pvpKind, c.pvpKind)) continue;
        const rc = dist[n.id];
        if (rc === undefined) continue;
        if (rc < bestNodeCost) { bestNodeCost = rc; bestNode = n.id; }
      }
      if (bestNode === null || bestNodeCost > rem) continue;
      const eff = bestNodeCost === 0 ? Infinity : c.weightBase / bestNodeCost;
      if (eff > bestEff) { bestEff = eff; bestCost = bestNodeCost; placeMove = { c, nodeId: bestNode }; levelMove = null; }
    }
    // Option B: level up an already-placed node.
    for (const a of placed) {
      if (a.level >= SAFETY_LEVEL_CAP) continue;
      const cost = RARITY_POINT_COST[a.rarity];
      if (cost > rem) continue;
      const gain = scoreAt(a.stats, a.rarity, a.level + 1) - scoreAt(a.stats, a.rarity, a.level);
      const eff = gain / cost;
      if (eff > bestEff) { bestEff = eff; bestCost = cost; levelMove = a; placeMove = null; }
    }

    if (placeMove) {
      const target = placeMove.nodeId;
      // open the cheapest path from the top; pass-through nodes stay empty (level 1)
      let curId: string | null = target;
      while (curId && !unlocked.has(curId)) {
        unlocked.add(curId);
        curId = prev[curId];
      }
      const n = TREE_NODE_BY_ID[target];
      souledNodes.add(target);
      placedSouls.add(placeMove.c.soulId);
      placed.push({ slotId: target, soulId: placeMove.c.soulId, soulLevel: placeMove.c.soulLevel, rarity: n.rarity, stats: placeMove.c.stats, level: 1 });
      spent += bestCost;
    } else if (levelMove) {
      levelMove.level += 1;
      spent += bestCost;
    } else {
      break;
    }
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
  // Farm é holístico: EXP domina, mas sobrevivência/sustain (HP/MP/STM/Absorb/Run)
  // também ajudam a farmar mais e potar menos, então entram com peso menor.
  { id: 'exp', name: 'EXP / Farm', weights: { exp: 20, absorb: 0.12, hp: 0.03, mana: 0.03, stamina: 0.02, moveSpeed: 1, defense: 0.02 } },
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
    name: '1v1 (híbrido)',
    weights: { attackPower: 1, attackRating: 0.5, defense: 1, absorb: 3, evade: 40, critRate: 30 },
    includePvp: true,
  },
  // PvP puro — usa SÓ as souls de PvP (Vault / Skillmaster / Vengeful Saint...).
  {
    id: 'pvp-atk',
    name: 'PvP Ataque (só PvP)',
    weights: { attackPower: 1, attackRating: 0.5, critRate: 30 },
    includePvp: true,
    pvpOnly: true,
  },
  {
    id: 'pvp-def',
    name: 'PvP Defesa (só PvP)',
    weights: { defense: 1, absorb: 3, evade: 40, block: 40, hp: 0.5 },
    includePvp: true,
    pvpOnly: true,
  },
];
