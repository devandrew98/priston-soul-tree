// SearchController — main-thread orchestration of the deep search:
//   seeds (greedy result + KnowledgeBase) -> N parallel workers -> merge ->
//   confidence -> store knowledge. Falls back to an inline chunked run when
//   Workers are unavailable, so the feature never hard-fails.

import type { Inventory } from '../lib/types';
import { optimize, type Goal } from '../lib/optimizer';
import type {
  EngineConfig,
  EvaluatedBuild,
  Genome,
  SearchOutcome,
  SearchProgress,
  SolverResult,
  WorkerMessage,
  WorkerRequest,
} from './types';
import { evaluate, slotsToGenome } from './genome';
import { SearchEngine } from './search';
import { KnowledgeBase } from './knowledge';

export interface DeepProgress extends SearchProgress {
  timeMs: number;
}

function mergeOutcomes(outcomes: SearchOutcome[]): SearchOutcome & { agreement: number } {
  const byHash = new Map<string, EvaluatedBuild>();
  let sims = 0;
  let elapsedMs = 0;
  let stoppedByPlateau = false;
  for (const o of outcomes) {
    sims += o.sims;
    elapsedMs = Math.max(elapsedMs, o.elapsedMs);
    stoppedByPlateau = stoppedByPlateau || o.stoppedByPlateau;
    for (const b of o.top) if (!byHash.has(b.hash)) byHash.set(b.hash, b);
  }
  const top = [...byHash.values()].sort((a, b) => b.score.total - a.score.total).slice(0, 5);
  const bestScore = top[0]?.score.total ?? 0;
  // bestAt of whichever run found the global best; agreement = runs within 1%.
  let bestAtMs = 0;
  let agree = 0;
  for (const o of outcomes) {
    const runBest = o.top[0]?.score.total ?? 0;
    if (runBest >= bestScore * 0.99) agree++;
    if (runBest === bestScore) bestAtMs = Math.max(bestAtMs, o.bestAtMs);
  }
  return { top, sims, elapsedMs, bestAtMs, stoppedByPlateau, agreement: outcomes.length ? agree / outcomes.length : 0 };
}

function runInWorkers(
  cfg: EngineConfig,
  seeds: Genome[],
  count: number,
  onProgress?: (p: DeepProgress) => void,
): Promise<SearchOutcome[]> {
  return new Promise((resolve, reject) => {
    const outcomes: SearchOutcome[] = [];
    const progressByW: (SearchProgress | undefined)[] = new Array(count);
    let done = 0;
    let failed = false;
    const ws: Worker[] = [];
    const fail = (err: unknown) => {
      if (failed) return;
      failed = true;
      for (const w of ws) w.terminate();
      reject(err);
    };
    for (let i = 0; i < count; i++) {
      let w: Worker;
      try {
        w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      } catch (e) {
        fail(e);
        return;
      }
      ws.push(w);
      w.onerror = (e) => fail(e);
      w.onmessage = (ev: MessageEvent<WorkerMessage>) => {
        const m = ev.data;
        if (m.type === 'progress') {
          progressByW[i] = m.progress;
          let sims = 0;
          let best = 0;
          let elapsedMs = 0;
          for (const p of progressByW) {
            if (!p) continue;
            sims += p.sims;
            best = Math.max(best, p.best);
            elapsedMs = Math.max(elapsedMs, p.elapsedMs);
          }
          onProgress?.({ sims, best, elapsedMs, timeMs: cfg.timeMs });
        } else {
          outcomes[i] = m.outcome;
          done++;
          if (done === count && !failed) {
            for (const x of ws) x.terminate();
            resolve(outcomes.filter(Boolean));
          }
        }
      };
      const req: WorkerRequest = { config: { ...cfg, rngSeed: cfg.rngSeed + i * 7919 }, seeds };
      w.postMessage(req);
    }
  });
}

async function runInline(cfg: EngineConfig, seeds: Genome[], onProgress?: (p: DeepProgress) => void): Promise<SearchOutcome[]> {
  const engine = new SearchEngine(cfg, seeds);
  while (!engine.finished) {
    engine.step(300);
    onProgress?.({ ...engine.progress(), timeMs: cfg.timeMs });
    await new Promise((r) => setTimeout(r, 0)); // keep the UI alive
  }
  return [engine.outcome()];
}

/** The public entry: run the whole deep optimization for a config. */
export async function deepOptimize(cfg: EngineConfig, onProgress?: (p: DeepProgress) => void): Promise<SolverResult> {
  const kb = new KnowledgeBase();

  // Seed 1: the fast greedy build (strong, instant starting point).
  const goal: Goal = { id: 'custom', name: 'custom', weights: cfg.weights, includePvp: cfg.includePvp, custom: true };
  const greedy = optimize(goal, cfg.inventory as Inventory, { budget: cfg.budget, allSouls: cfg.allSouls });
  const seeds: Genome[] = [slotsToGenome(greedy.slots)];
  const seedScore = evaluate(seeds[0], cfg.weights).score.total;

  // Seed 2: best build KNOWN for this exact profile (accumulated knowledge).
  const known = kb.load(cfg);
  if (known) seeds.push(known.genome);

  const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;
  const workers = Math.max(1, Math.min(4, cores - 1));

  let outcomes: SearchOutcome[];
  let usedWorkers = workers;
  try {
    outcomes = await runInWorkers(cfg, seeds, workers, onProgress);
    if (!outcomes.length) throw new Error('no outcomes');
  } catch {
    usedWorkers = 0; // inline fallback
    outcomes = await runInline(cfg, seeds, onProgress);
  }

  const merged = mergeOutcomes(outcomes);
  const plateauRatio = merged.elapsedMs > 0 ? Math.min(1, Math.max(0, (merged.elapsedMs - merged.bestAtMs) / merged.elapsedMs)) : 0;
  const confidence = Math.round(100 * (0.5 * plateauRatio + 0.3 * merged.agreement + 0.2 * Math.min(1, merged.sims / 15000)));

  const result: SolverResult = {
    ...merged,
    confidence,
    workers: usedWorkers,
    fromKnowledge: !!known,
    seedScore,
  };

  if (result.top[0]) {
    kb.save(cfg, result.top[0], merged.sims);
    kb.recordRun(merged.sims, merged.elapsedMs, result.top[0].score.total);
  }
  return result;
}
