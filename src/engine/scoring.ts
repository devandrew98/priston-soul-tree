// ScoringEngine — turns any build (Genome) into a single comparable Score,
// with an offense/defense/utility breakdown used by the ExplainabilityEngine.

import { TREE_NODE_BY_ID } from '../lib/tree';
import { SOULS_BY_ID } from '../lib/souls';
import { nodeFinalValue } from '../lib/formula';
import type { Genome, ScoreBreakdown, Weights } from './types';

const OFFENSE = new Set(['attackPower', 'attackRating', 'critRate']);
const DEFENSE = new Set(['defense', 'absorb', 'hp', 'evade', 'block']);

/**
 * Weighted score of a genome. `points` is passed in (computed by the
 * PathFinder) so this stays a pure fold over the placed souls.
 */
export function scoreGenome(genome: Genome, weights: Weights, points: number): ScoreBreakdown {
  let offense = 0;
  let defense = 0;
  let utility = 0;
  for (const nodeId of Object.keys(genome)) {
    const g = genome[nodeId];
    const node = TREE_NODE_BY_ID[nodeId];
    const soul = SOULS_BY_ID[g.soulId];
    if (!node || !soul) continue;
    for (const st of soul.stats) {
      const w = weights[st.stat];
      if (!w) continue;
      const v = w * nodeFinalValue(st.ranks[g.soulLevel - 1], node.rarity, g.nodeLevel);
      if (OFFENSE.has(st.stat)) offense += v;
      else if (DEFENSE.has(st.stat)) defense += v;
      else utility += v;
    }
  }
  const total = offense + defense + utility;
  return { total, offense, defense, utility, points, perPoint: points > 0 ? total / points : 0 };
}
