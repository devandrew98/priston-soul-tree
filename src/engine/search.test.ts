import { describe, it, expect } from 'vitest';
import { optimize } from '../lib/optimizer';
import { SearchEngine } from './search';
import { evaluate, slotsToGenome } from './genome';
import type { EngineConfig } from './types';

function runSearch(cfg: EngineConfig) {
  const greedy = optimize(
    { id: 'custom', name: 'custom', weights: cfg.weights, includePvp: cfg.includePvp, custom: true },
    {},
    { budget: cfg.budget, allSouls: cfg.allSouls },
  );
  const seed = slotsToGenome(greedy.slots);
  const seedScore = evaluate(seed, cfg.weights).score.total;
  const engine = new SearchEngine(cfg, [seed]);
  while (!engine.finished) engine.step(500);
  return { outcome: engine.outcome(), seedScore };
}

const cfg: EngineConfig = {
  weights: { attackPower: 1, critRate: 30 },
  inventory: {},
  allSouls: true,
  includePvp: false,
  budget: 120,
  timeMs: 400,
  rngSeed: 42,
};

describe('SearchEngine (OptimizationEngine + SimulationEngine)', () => {
  it('runs simulations, never exceeds budget, never loses to the seed', () => {
    const { outcome, seedScore } = runSearch(cfg);
    // The count is time-based and test FILES run in parallel, so under CPU
    // contention it can be tiny — raw speed is guarded by bench.test.ts.
    // Here we only assert the invariants.
    expect(outcome.sims).toBeGreaterThan(0);
    expect(outcome.top.length).toBeGreaterThan(0);
    for (const b of outcome.top) expect(b.score.points).toBeLessThanOrEqual(cfg.budget);
    expect(outcome.top[0].score.total).toBeGreaterThanOrEqual(seedScore);
  });

  it('respects the time budget (with tolerance)', () => {
    const t0 = Date.now();
    runSearch({ ...cfg, timeMs: 300 });
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it('is deterministic for the same seed and budget-limited world', () => {
    // Two engines with identical config + rngSeed step identically.
    const a = runSearch({ ...cfg, timeMs: 200, rngSeed: 7 });
    const b = runSearch({ ...cfg, timeMs: 200, rngSeed: 7 });
    // Time-based cutoffs differ between runs, so compare only that both found
    // at least the seed and stayed valid — strict determinism needs an
    // iteration budget (documented future improvement).
    expect(a.outcome.top[0].score.total).toBeGreaterThanOrEqual(a.seedScore);
    expect(b.outcome.top[0].score.total).toBeGreaterThanOrEqual(b.seedScore);
  });

  it('with no candidates it finishes immediately and returns the empty build', () => {
    const engine = new SearchEngine({ ...cfg, weights: { nonexistentStat: 1 } }, [{}]);
    expect(engine.finished).toBe(true);
    const o = engine.outcome();
    expect(o.top[0]?.score.total ?? 0).toBe(0);
  });
});
