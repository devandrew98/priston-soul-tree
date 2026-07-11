// PathFinder — connectivity and exact cost of a build under the game's unlock
// rules (every used node must be opened from the top; pass-through nodes cost
// their rarity price at level 1). Thin facade over the graph module so the
// engine has one authoritative cost function.
//
// BASELINE (nodes já abertas no jogo): pontos já investidos são CUSTO AFUNDADO —
// os nodes do baseline sempre contam como abertos e o nível investido é um PISO
// do custo (não dá pra rebaixar sem o item de reset). Colocar uma soul num node
// do baseline no nível do piso custa ZERO a mais → o motor reaproveita os
// pontos presos de graça.

import { unlockedFor } from '../lib/graph';
import { RARITY_POINT_COST, TREE_NODE_BY_ID } from '../lib/tree';
import type { Genome } from './types';

/** Every node that must be OPEN: souled + baseline + cheapest pass-through. */
export function openSetFor(genome: Genome, baseline?: Record<string, number>): Set<string> {
  const ids = baseline ? [...new Set([...Object.keys(genome), ...Object.keys(baseline)])] : Object.keys(genome);
  return unlockedFor(ids);
}

/**
 * Exact fusion-point cost of a genome. Matches calc.pointsSpent for the
 * equivalent Build (verified by tests) but works on the sparse genome.
 * With a baseline, each baseline node costs at least its invested level.
 */
export function genomeCost(genome: Genome, baseline?: Record<string, number>): number {
  const hasBaseline = !!baseline && Object.keys(baseline).length > 0;
  if (!hasBaseline && Object.keys(genome).length === 0) return 0;
  let sum = 0;
  for (const id of openSetFor(genome, hasBaseline ? baseline : undefined)) {
    const g = genome[id];
    const floor = (hasBaseline && baseline![id]) || 1; // nível já investido no jogo
    const level = Math.max(g ? g.nodeLevel : 1, floor);
    sum += RARITY_POINT_COST[TREE_NODE_BY_ID[id].rarity] * level;
  }
  return sum;
}
