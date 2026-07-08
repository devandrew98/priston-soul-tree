// Fill pass — "an opened node without a soul wastes its unlock points".
// Placing a level-1 soul on an already-opened pass-through node costs ZERO
// extra points (the unlock was already paid), so after the search we fill
// every opened-but-empty node with the most useful remaining soul:
//   1. souls that score for the GOAL (free score!),
//   2. SURVIVABILITY souls (wiki: even pure-damage builds must survive the map),
//   3. any other useful soul (anything beats an empty node).
// Then, if budget is left over, it is spent on the best marginal level-ups.

import type { Category, Rarity } from '../lib/types';
import { SOULS, SOULS_BY_ID } from '../lib/souls';
import { TREE_NODE_BY_ID, NODE_CATEGORY, RARITY_POINT_COST, RARITY_ORDER, acceptsSoul, pvpSoulKind, type PvpKind } from '../lib/tree';
import { nodeFinalValue } from '../lib/formula';
import { openSetFor, genomeCost } from './pathfinder';
import type { EngineConfig, Genome } from './types';

// General per-stat scale (mirrors the UI slider scales): "any stat beats nothing".
const GENERAL_SCALE: Record<string, number> = {
  attackPower: 1,
  attackRating: 0.6,
  critRate: 30,
  defense: 1,
  absorb: 3,
  hp: 0.3,
  mana: 0.3,
  evade: 40,
  block: 40,
  exp: 6,
  moveSpeed: 8,
  stamina: 0.3,
  agingSuccess: 30,
  ownItemType: 5,
  ownSpecChance: 5,
};
// Survivability emphasis (wiki.pristontale.eu — you must tank the map you farm).
const SURVIVAL_SCALE: Record<string, number> = { defense: 1, absorb: 3, hp: 0.3, evade: 40, block: 40 };

export type FillKind = 'goal' | 'survival' | 'general';

export interface FillAdded {
  nodeId: string;
  soulId: string;
  kind: FillKind;
}

interface FillerCand {
  soulId: string;
  soulLevel: 1 | 2 | 3;
  category: Category;
  rarity: Rarity;
  pvpKind: PvpKind | null;
  goal: number;
  surv: number;
  gen: number;
}

function fillerPool(cfg: EngineConfig, used: Set<string>): FillerCand[] {
  const out: FillerCand[] = [];
  for (const s of SOULS) {
    if (used.has(s.id)) continue;
    const lvl = (cfg.allSouls ? 3 : cfg.inventory[s.id]) as 1 | 2 | 3 | undefined;
    if (!lvl) continue;
    let goal = 0;
    let surv = 0;
    let gen = 0;
    for (const st of s.stats) {
      const base = st.ranks[lvl - 1];
      goal += (cfg.weights[st.stat] || 0) * base;
      surv += (SURVIVAL_SCALE[st.stat] || 0) * base;
      gen += (GENERAL_SCALE[st.stat] || 0) * base;
    }
    out.push({ soulId: s.id, soulLevel: lvl, category: s.category, rarity: s.rarity, pvpKind: pvpSoulKind(s), goal, surv, gen });
  }
  // Lexicographic-ish priority: goal ≫ survival ≫ general.
  out.sort((a, b) => b.goal * 1e6 + b.surv * 1e3 + b.gen - (a.goal * 1e6 + a.surv * 1e3 + a.gen));
  return out;
}

const kindOf = (c: FillerCand): FillKind => (c.goal > 0 ? 'goal' : c.surv > 0 ? 'survival' : 'general');

/**
 * Fill every opened-but-empty node of `g` (zero extra cost) and spend any
 * leftover budget on the best marginal level-ups. Never lowers the goal score,
 * never exceeds the budget, never breaks compatibility/uniqueness.
 */
export function fillGenome(g: Genome, cfg: EngineConfig): { genome: Genome; added: FillAdded[] } {
  const filled: Genome = { ...g };
  const added: FillAdded[] = [];
  const used = new Set(Object.values(g).map((x) => x.soulId));
  const pool = fillerPool(cfg, used);

  // 1) A soul on every opened-but-empty node (most restrictive nodes first,
  //    so legendary sockets are not starved by generous common ones).
  const empty = [...openSetFor(g)]
    .filter((id) => !filled[id] && TREE_NODE_BY_ID[id])
    .sort((a, b) => RARITY_ORDER[TREE_NODE_BY_ID[b].rarity] - RARITY_ORDER[TREE_NODE_BY_ID[a].rarity]);
  for (const nodeId of empty) {
    const node = TREE_NODE_BY_ID[nodeId];
    const cat = NODE_CATEGORY[node.type];
    const idx = pool.findIndex(
      (c) =>
        acceptsSoul(cat, node.rarity, c.category, c.rarity, node.pvpKind, c.pvpKind) &&
        // PvP souls only help in PvP: use them as fillers only when the goal
        // includes PvP, or on PvP nodes (where nothing else fits anyway).
        (cfg.includePvp || c.category !== 'pvp' || cat === 'pvp'),
    );
    if (idx < 0) continue; // no compatible soul left — node stays empty
    const c = pool.splice(idx, 1)[0];
    filled[nodeId] = { soulId: c.soulId, soulLevel: c.soulLevel, nodeLevel: 1 };
    added.push({ nodeId, soulId: c.soulId, kind: kindOf(c) });
  }

  // 2) Leftover points -> best marginal level-ups (goal ≫ survival ≫ general).
  let spent = genomeCost(filled);
  for (let guard = 0; guard < 1000; guard++) {
    let bestId: string | null = null;
    let bestEff = 0;
    let bestCost = 0;
    for (const nodeId of Object.keys(filled)) {
      const gene = filled[nodeId];
      const node = TREE_NODE_BY_ID[nodeId];
      const cost = RARITY_POINT_COST[node.rarity];
      if (spent + cost > cfg.budget) continue;
      const soul = SOULS_BY_ID[gene.soulId];
      if (!soul) continue;
      let gain = 0;
      for (const st of soul.stats) {
        const w = (cfg.weights[st.stat] || 0) * 1e6 + (SURVIVAL_SCALE[st.stat] || 0) * 1e3 + (GENERAL_SCALE[st.stat] || 0);
        if (!w) continue;
        const base = st.ranks[gene.soulLevel - 1];
        gain += w * (nodeFinalValue(base, node.rarity, gene.nodeLevel + 1) - nodeFinalValue(base, node.rarity, gene.nodeLevel));
      }
      const eff = gain / cost;
      if (eff > bestEff) {
        bestEff = eff;
        bestId = nodeId;
        bestCost = cost;
      }
    }
    if (!bestId) break;
    filled[bestId] = { ...filled[bestId], nodeLevel: filled[bestId].nodeLevel + 1 };
    spent += bestCost;
  }

  return { genome: filled, added };
}
