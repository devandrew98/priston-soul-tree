// Genome — sparse build representation + the operations the search engine
// uses to explore the space: candidates, hashing, mutation and conversion
// to/from the app's SlotState shape.

import type { Category, Rarity, SlotState } from '../lib/types';
import { SOULS } from '../lib/souls';
import { TREE_NODES, NODE_CATEGORY, acceptsSoul, pvpSoulKind, type PvpKind } from '../lib/tree';
import type { EngineConfig, EvaluatedBuild, Genome, Weights } from './types';
import { genomeCost } from './pathfinder';
import { scoreGenome } from './scoring';
import type { Rng } from './rng';

export interface CandidateSoul {
  soulId: string;
  soulLevel: 1 | 2 | 3;
  category: Category;
  rarity: Rarity;
  pvpKind: PvpKind | null; // PvP souls: offensive or defensive flavor
  value: number; // weighted base value (for seeding bias)
}

/** Souls usable under this config that contribute to the goal, strongest first. */
export function candidateSouls(cfg: EngineConfig): CandidateSoul[] {
  const out: CandidateSoul[] = [];
  for (const s of SOULS) {
    const lvl = (cfg.allSouls ? 3 : cfg.inventory[s.id]) as 1 | 2 | 3 | undefined;
    if (!lvl) continue;
    if (s.category === 'pvp' && !cfg.includePvp) continue;
    let v = 0;
    for (const st of s.stats) {
      const w = cfg.weights[st.stat];
      if (w) v += w * st.ranks[lvl - 1];
    }
    if (v <= 0) continue;
    out.push({ soulId: s.id, soulLevel: lvl, category: s.category, rarity: s.rarity, pvpKind: pvpSoulKind(s), value: v });
  }
  out.sort((a, b) => b.value - a.value);
  return out;
}

/** Node ids where a candidate soul may legally sit. */
export function compatibleNodes(cands: CandidateSoul[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of cands) {
    m.set(
      c.soulId,
      TREE_NODES.filter((n) => acceptsSoul(NODE_CATEGORY[n.type], n.rarity, c.category, c.rarity, n.pvpKind, c.pvpKind)).map(
        (n) => n.id,
      ),
    );
  }
  return m;
}

export function hashGenome(g: Genome): string {
  return Object.keys(g)
    .sort()
    .map((id) => `${id}:${g[id].soulId}:${g[id].soulLevel}:${g[id].nodeLevel}`)
    .join('|');
}

export function genomeToSlots(g: Genome): Record<string, SlotState> {
  const slots: Record<string, SlotState> = {};
  for (const n of TREE_NODES) slots[n.id] = { soulId: null, soulLevel: 1, nodeLevel: 1 };
  for (const id of Object.keys(g)) {
    slots[id] = { soulId: g[id].soulId, soulLevel: g[id].soulLevel, nodeLevel: g[id].nodeLevel };
  }
  return slots;
}

export function slotsToGenome(slots: Record<string, SlotState>): Genome {
  const g: Genome = {};
  for (const [id, s] of Object.entries(slots)) {
    if (s.soulId) g[id] = { soulId: s.soulId, soulLevel: s.soulLevel, nodeLevel: s.nodeLevel };
  }
  return g;
}

export function evaluate(genome: Genome, weights: Weights, baseline?: Record<string, number>): EvaluatedBuild {
  const points = genomeCost(genome, baseline);
  return { genome, hash: hashGenome(genome), score: scoreGenome(genome, weights, points) };
}

/**
 * One random, structurally VALID neighbor of `g` (souls stay unique, category
 * and rarity compatibility respected). Budget is checked by the caller after
 * evaluation. Returns null when the drawn operation is not applicable.
 * With a `baseline`, node levels never go below the invested floor and new
 * placements on baseline nodes start AT the floor (reusing the sunk points).
 */
export function mutate(
  g: Genome,
  cands: CandidateSoul[],
  nodesByCand: Map<string, string[]>,
  rng: Rng,
  baseline?: Record<string, number>,
): Genome | null {
  const entries = Object.entries(g);
  const usedSouls = new Set(entries.map(([, x]) => x.soulId));
  const op = Math.floor(rng() * 7);

  if (op === 0) {
    // ADD an unused soul to a free compatible node (biased toward strong souls)
    const free = cands.filter((c) => !usedSouls.has(c.soulId));
    if (!free.length) return null;
    const c = free[Math.floor(rng() * rng() * free.length)];
    const spots = (nodesByCand.get(c.soulId) || []).filter((id) => !g[id]);
    if (!spots.length) return null;
    const id = spots[Math.floor(rng() * spots.length)];
    // baseline: começa no nível já investido (custo extra zero, valor de graça)
    return { ...g, [id]: { soulId: c.soulId, soulLevel: c.soulLevel, nodeLevel: baseline?.[id] ?? 1 } };
  }
  if (!entries.length) return null;
  const [idA, ga] = entries[Math.floor(rng() * entries.length)];

  if (op === 1) {
    // REMOVE
    const copy = { ...g };
    delete copy[idA];
    return copy;
  }
  if (op === 2) {
    // MOVE the soul to a different free compatible node
    const spots = (nodesByCand.get(ga.soulId) || []).filter((id) => id !== idA && !g[id]);
    if (!spots.length) return null;
    const id = spots[Math.floor(rng() * spots.length)];
    const copy = { ...g };
    delete copy[idA];
    copy[id] = { ...ga, nodeLevel: Math.max(ga.nodeLevel, baseline?.[id] ?? 1) };
    return copy;
  }
  if (op === 3) {
    // SWAP two souls (both must be legal on the other's node); node levels stay put
    if (entries.length < 2) return null;
    const [idB, gb] = entries[Math.floor(rng() * entries.length)];
    if (idB === idA) return null;
    const okA = nodesByCand.get(ga.soulId)?.includes(idB);
    const okB = nodesByCand.get(gb.soulId)?.includes(idA);
    if (!okA || !okB) return null;
    return {
      ...g,
      [idA]: { soulId: gb.soulId, soulLevel: gb.soulLevel, nodeLevel: ga.nodeLevel },
      [idB]: { soulId: ga.soulId, soulLevel: ga.soulLevel, nodeLevel: gb.nodeLevel },
    };
  }
  if (op === 4) {
    // REPLACE the soul with a different unused compatible one
    const free = cands.filter((c) => !usedSouls.has(c.soulId) && nodesByCand.get(c.soulId)?.includes(idA));
    if (!free.length) return null;
    const c = free[Math.floor(rng() * free.length)];
    return { ...g, [idA]: { soulId: c.soulId, soulLevel: c.soulLevel, nodeLevel: ga.nodeLevel } };
  }
  if (op === 5) {
    // LEVEL UP
    return { ...g, [idA]: { ...ga, nodeLevel: ga.nodeLevel + 1 } };
  }
  // LEVEL DOWN — nunca abaixo do piso já investido no jogo (baseline)
  const floor = baseline?.[idA] ?? 1;
  if (ga.nodeLevel <= floor) return null;
  return { ...g, [idA]: { ...ga, nodeLevel: ga.nodeLevel - 1 } };
}

/** A few forced random mutations — used to escape plateaus (restart kick). */
export function perturb(
  g: Genome,
  cands: CandidateSoul[],
  nodesByCand: Map<string, string[]>,
  rng: Rng,
  baseline?: Record<string, number>,
): Genome {
  let cur = g;
  const kicks = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < kicks; i++) {
    for (let tries = 0; tries < 6; tries++) {
      const nx = mutate(cur, cands, nodesByCand, rng, baseline);
      if (nx) {
        cur = nx;
        break;
      }
    }
  }
  return cur;
}
