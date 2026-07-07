// PathFinder — connectivity and exact cost of a build under the game's unlock
// rules (every used node must be opened from the top; pass-through nodes cost
// their rarity price at level 1). Thin facade over the graph module so the
// engine has one authoritative cost function.

import { unlockedFor } from '../lib/graph';
import { RARITY_POINT_COST, TREE_NODE_BY_ID } from '../lib/tree';
import type { Genome } from './types';

/** Every node that must be OPEN for this genome (souled + cheapest pass-through). */
export function openSetFor(genome: Genome): Set<string> {
  return unlockedFor(Object.keys(genome));
}

/**
 * Exact fusion-point cost of a genome. Matches calc.pointsSpent for the
 * equivalent Build (verified by tests) but works on the sparse genome.
 */
export function genomeCost(genome: Genome): number {
  const ids = Object.keys(genome);
  if (!ids.length) return 0;
  let sum = 0;
  for (const id of openSetFor(genome)) {
    const g = genome[id];
    const level = g ? Math.max(1, g.nodeLevel) : 1;
    sum += RARITY_POINT_COST[TREE_NODE_BY_ID[id].rarity] * level;
  }
  return sum;
}
