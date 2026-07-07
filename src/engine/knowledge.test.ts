import { describe, it, expect } from 'vitest';
import { KnowledgeBase, memoryStorage, profileKey } from './knowledge';
import { candidateSouls, compatibleNodes, evaluate } from './genome';
import type { EngineConfig, Genome } from './types';

const cfg: EngineConfig = {
  weights: { attackPower: 1 },
  inventory: {},
  allSouls: true,
  includePvp: false,
  budget: 60,
  timeMs: 100,
  rngSeed: 1,
};

function someBuild(): Genome {
  const cands = candidateSouls(cfg);
  const nodes = compatibleNodes(cands);
  const c = cands[0];
  const [nId] = nodes.get(c.soulId)!;
  return { [nId]: { soulId: c.soulId, soulLevel: c.soulLevel, nodeLevel: 2 } };
}

describe('KnowledgeBase + StatisticsEngine', () => {
  it('profileKey changes with budget/weights, stable for the same question', () => {
    expect(profileKey(cfg)).toBe(profileKey({ ...cfg }));
    expect(profileKey(cfg)).not.toBe(profileKey({ ...cfg, budget: 61 }));
    expect(profileKey(cfg)).not.toBe(profileKey({ ...cfg, weights: { defense: 1 } }));
  });

  it('saves and reloads the best build for a profile', () => {
    const kb = new KnowledgeBase(memoryStorage());
    expect(kb.load(cfg)).toBeNull();
    const ev = evaluate(someBuild(), cfg.weights);
    kb.save(cfg, ev, 1000);
    const back = kb.load(cfg);
    expect(back).not.toBeNull();
    expect(back!.genome).toEqual(ev.genome);
    expect(back!.score).toBe(ev.score.total);
  });

  it('keeps only the best score for a profile', () => {
    const kb = new KnowledgeBase(memoryStorage());
    const ev = evaluate(someBuild(), cfg.weights);
    kb.save(cfg, ev, 10);
    const worse = { ...ev, score: { ...ev.score, total: ev.score.total - 5 } };
    kb.save(cfg, worse, 10);
    expect(kb.load(cfg)!.score).toBe(ev.score.total);
  });

  it('statistics accumulate across runs', () => {
    const kb = new KnowledgeBase(memoryStorage());
    kb.recordRun(1000, 3000, 50);
    kb.recordRun(2000, 3000, 80);
    const s = kb.stats();
    expect(s.runs).toBe(2);
    expect(s.sims).toBe(3000);
    expect(s.bestEver).toBe(80);
  });
});
