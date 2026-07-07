// Micro-benchmark of the solver hot path. Guards against performance
// regressions on genomeCost (the dominant cost per simulation).
import { describe, it, expect } from 'vitest';
import { optimize } from '../lib/optimizer';
import { candidateSouls, compatibleNodes, hashGenome, mutate, slotsToGenome } from './genome';
import { genomeCost } from './pathfinder';
import { scoreGenome } from './scoring';
import { mulberry32 } from './rng';
import type { EngineConfig } from './types';

const cfg: EngineConfig = {
  weights: { attackPower: 1, critRate: 30 },
  inventory: {},
  allSouls: true,
  includePvp: false,
  budget: 120,
  timeMs: 400,
  rngSeed: 42,
};

describe('bench', () => {
  it('times the hot path pieces', () => {
    const greedy = optimize({ id: 'c', name: 'c', weights: cfg.weights, custom: true }, {}, { budget: 120, allSouls: true });
    const g = slotsToGenome(greedy.slots);
    const cands = candidateSouls(cfg);
    const nodesBy = compatibleNodes(cands);
    const rng = mulberry32(1);
    const N = 300;

    // Best-of-2 to shrug off transient machine load (a single noisy pass once
    // tripped the guard at 169ms while the true cost was ~33ms).
    let costMs = Infinity;
    for (let pass = 0; pass < 2; pass++) {
      const t0 = performance.now();
      for (let i = 0; i < N; i++) genomeCost(g);
      costMs = Math.min(costMs, performance.now() - t0);
    }
    console.log('genomeCost x300 (best of 2):', costMs.toFixed(1), 'ms');
    expect(costMs).toBeLessThan(150); // regression guard (was 281ms before the typed-array Steiner)
    let t = performance.now();

    t = performance.now();
    for (let i = 0; i < N; i++) scoreGenome(g, cfg.weights, 100);
    console.log('scoreGenome x300:', (performance.now() - t).toFixed(1), 'ms');

    t = performance.now();
    for (let i = 0; i < N; i++) hashGenome(g);
    console.log('hashGenome x300:', (performance.now() - t).toFixed(1), 'ms');

    t = performance.now();
    for (let i = 0; i < N; i++) mutate(g, cands, nodesBy, rng);
    console.log('mutate x300:', (performance.now() - t).toFixed(1), 'ms');

    console.log('genome size:', Object.keys(g).length);
  });
});
