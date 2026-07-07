import { describe, it, expect } from 'vitest';
import { optimize } from '../lib/optimizer';
import { SOULS_BY_ID } from '../lib/souls';
import { TREE_NODE_BY_ID, NODE_CATEGORY, acceptsSoul } from '../lib/tree';
import { fillGenome } from './filler';
import { candidateSouls, compatibleNodes, evaluate, slotsToGenome } from './genome';
import { genomeCost, openSetFor } from './pathfinder';
import type { EngineConfig, Genome } from './types';

const cfg: EngineConfig = {
  weights: { attackPower: 1, critRate: 30 },
  inventory: {},
  allSouls: true,
  includePvp: false,
  budget: 120,
  timeMs: 100,
  rngSeed: 1,
};

function greedyGenome(c: EngineConfig): Genome {
  const r = optimize(
    { id: 'c', name: 'c', weights: c.weights, includePvp: c.includePvp, custom: true },
    {},
    { budget: c.budget, allSouls: c.allSouls },
  );
  return slotsToGenome(r.slots);
}

describe('Fill pass (empty opened nodes waste points)', () => {
  it('fills every opened-but-empty node that has a compatible soul left', () => {
    const g = greedyGenome(cfg);
    const { genome: filled } = fillGenome(g, cfg);
    const emptyOpen = [...openSetFor(filled)].filter((id) => !filled[id]);
    // with allSouls there are souls for every category — nothing may stay empty
    expect(emptyOpen).toEqual([]);
    expect(Object.keys(filled).length).toBeGreaterThanOrEqual(Object.keys(g).length);
  });

  it('never lowers the goal score and never exceeds the budget', () => {
    const g = greedyGenome(cfg);
    const before = evaluate(g, cfg.weights);
    const { genome: filled } = fillGenome(g, cfg);
    const after = evaluate(filled, cfg.weights);
    expect(after.score.total).toBeGreaterThanOrEqual(before.score.total);
    expect(after.score.points).toBeLessThanOrEqual(cfg.budget);
  });

  it('spends leftover budget on level-ups (no wasted points)', () => {
    const small: EngineConfig = { ...cfg, budget: 60 };
    const g = greedyGenome(small);
    const { genome: filled } = fillGenome(g, small);
    const spent = genomeCost(filled);
    expect(spent).toBeLessThanOrEqual(small.budget);
    // leftover must be smaller than the cheapest possible level-up (max rarity cost 3)
    expect(small.budget - spent).toBeLessThan(3);
  });

  it('keeps every filled genome structurally valid (compatibility + uniqueness)', () => {
    const g = greedyGenome(cfg);
    const { genome: filled } = fillGenome(g, cfg);
    const soulIds = Object.values(filled).map((x) => x.soulId);
    expect(new Set(soulIds).size).toBe(soulIds.length);
    for (const [nodeId, gene] of Object.entries(filled)) {
      const node = TREE_NODE_BY_ID[nodeId];
      const soul = SOULS_BY_ID[gene.soulId];
      expect(acceptsSoul(NODE_CATEGORY[node.type], node.rarity, soul.category, soul.rarity)).toBe(true);
    }
  });

  it('with no souls left it degrades gracefully (nodes stay empty, no crash)', () => {
    const all = candidateSouls(cfg);
    const nodes = compatibleNodes(all);
    const c = all[0];
    const spots = nodes.get(c.soulId)!;
    const far = spots[spots.length - 1]; // deepest compatible node -> forces pass-throughs
    const g: Genome = { [far]: { soulId: c.soulId, soulLevel: 3, nodeLevel: 1 } };
    const lone: EngineConfig = { ...cfg, allSouls: false, inventory: { [c.soulId]: 3 } };
    const { genome: filled, added } = fillGenome(g, lone);
    expect(added.filter((a) => a.kind !== 'goal').length).toBe(0); // nothing else to place
    expect(Object.keys(filled).length).toBe(1);
    expect(genomeCost(filled)).toBeLessThanOrEqual(lone.budget);
  });
});
