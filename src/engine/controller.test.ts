import { describe, it, expect } from 'vitest';
import { bestGreedyGenome } from './controller';
import { evaluate } from './genome';
import { genomeCost } from './pathfinder';
import { optimize } from '../lib/optimizer';
import { MAX_FUSION_POINTS } from '../lib/formula';
import type { EngineConfig } from './types';

// The user's reported scenario: full Attack Power (slider 100) + 1% Absorb.
const W = { attackPower: 100, absorb: 3 };
const mk = (budget: number): EngineConfig => ({
  weights: W,
  inventory: {},
  allSouls: true,
  includePvp: false,
  budget,
  timeMs: 0,
  rngSeed: 1,
});

describe('bestGreedyGenome (budget-monotonic quick build)', () => {
  it('more budget never yields a worse build (lvl 198->201 bug: 214 -> 217 pts)', () => {
    const e214 = evaluate(bestGreedyGenome(mk(214)), W);
    const e217 = evaluate(bestGreedyGenome(mk(217)), W);
    expect(e217.score.total).toBeGreaterThanOrEqual(e214.score.total);
    // the reported symptom: Attack Power (offense) DROPPED with more budget
    expect(e217.score.offense).toBeGreaterThanOrEqual(e214.score.offense);
    expect(e217.score.points).toBeLessThanOrEqual(217);
  });

  it('respects the requested budget exactly', () => {
    const g = bestGreedyGenome(mk(217));
    expect(genomeCost(g)).toBeLessThanOrEqual(217);
    const g2 = bestGreedyGenome(mk(100));
    expect(genomeCost(g2)).toBeLessThanOrEqual(100);
  });
});

describe('hard fusion caps (level 201 / 217 points)', () => {
  it('the greedy optimizer never spends beyond 217 even with an absurd budget', () => {
    const r = optimize({ id: 'c', name: 'c', weights: W, custom: true }, {}, { budget: 99999, allSouls: true });
    expect(r.pointsSpent).toBeLessThanOrEqual(MAX_FUSION_POINTS);
  });

  it('no budget given means the 217 cap, not infinity', () => {
    const r = optimize({ id: 'c', name: 'c', weights: W, custom: true }, {}, { allSouls: true });
    expect(r.pointsSpent).toBeLessThanOrEqual(MAX_FUSION_POINTS);
  });
});
