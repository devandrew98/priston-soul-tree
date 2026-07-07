import { describe, it, expect } from 'vitest';
import { scoreGenome } from './scoring';
import { candidateSouls } from './genome';
import type { EngineConfig, Genome } from './types';
import { TREE_NODES } from '../lib/tree';

const cfg: EngineConfig = {
  weights: { attackPower: 1 },
  inventory: {},
  allSouls: true,
  includePvp: false,
  budget: 100,
  timeMs: 100,
  rngSeed: 1,
};

function anyAtkGenome(nodeLevel: number): Genome {
  const cands = candidateSouls(cfg);
  expect(cands.length).toBeGreaterThan(0);
  const c = cands[0];
  // place it on the first compatible node
  const node = TREE_NODES.find((n) => n.type === 'atk' && n.rarity === c.rarity) ?? TREE_NODES[0];
  return { [node.id]: { soulId: c.soulId, soulLevel: c.soulLevel, nodeLevel } };
}

describe('ScoringEngine', () => {
  it('empty genome scores zero', () => {
    const s = scoreGenome({}, { attackPower: 1 }, 0);
    expect(s.total).toBe(0);
    expect(s.perPoint).toBe(0);
  });

  it('score is deterministic and breakdown sums to total', () => {
    const g = anyAtkGenome(3);
    const a = scoreGenome(g, cfg.weights, 10);
    const b = scoreGenome(g, cfg.weights, 10);
    expect(a.total).toBe(b.total);
    expect(a.offense + a.defense + a.utility).toBeCloseTo(a.total, 9);
  });

  it('higher node level never lowers the score', () => {
    const s1 = scoreGenome(anyAtkGenome(1), cfg.weights, 1);
    const s5 = scoreGenome(anyAtkGenome(5), cfg.weights, 5);
    expect(s5.total).toBeGreaterThan(s1.total);
  });

  it('weights of zero contribute nothing', () => {
    const g = anyAtkGenome(3);
    const s = scoreGenome(g, { defense: 1 }, 10); // attack soul, defense-only goal
    expect(s.offense).toBe(0);
  });
});
