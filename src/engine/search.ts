// SearchEngine — the OptimizationEngine + SimulationEngine core.
// Stochastic hill-climbing with restarts over the Genome space:
//   evaluate thousands of neighbor builds, accept improvements, kick out of
//   plateaus, keep the top-K distinct builds found.
// Honors a hard TimeBudget and stops early on a hard plateau. One instance is
// run per worker (each with its own RNG seed) and the controller merges them.

import type { EngineConfig, EvaluatedBuild, Genome, ScoreBreakdown, SearchOutcome, SearchProgress } from './types';
import { candidateSouls, compatibleNodes, hashGenome, mutate, perturb, type CandidateSoul } from './genome';
import { genomeCost } from './pathfinder';
import { scoreGenome } from './scoring';
import { mulberry32, type Rng } from './rng';

const TOP_K = 8;
const RESTART_AFTER = 2200; // sims without improvement -> kick from best
const CACHE_MAX = 60000;

export class SearchEngine {
  private cfg: EngineConfig;
  private cands: CandidateSoul[];
  private nodesByCand: Map<string, string[]>;
  private rng: Rng;
  private cache = new Map<string, ScoreBreakdown>(); // CacheEngine (in-run memoization)

  private cur: EvaluatedBuild;
  private best: EvaluatedBuild;
  private top = new Map<string, EvaluatedBuild>();

  sims = 0;
  private startedAt = Date.now();
  private bestAt = this.startedAt;
  private simsAtImprove = 0;
  stoppedByPlateau = false;
  private noCandidates = false;

  constructor(cfg: EngineConfig, seeds: Genome[]) {
    this.cfg = cfg;
    this.cands = candidateSouls(cfg);
    this.nodesByCand = compatibleNodes(this.cands);
    this.rng = mulberry32(cfg.rngSeed);
    this.noCandidates = this.cands.length === 0;

    // Best valid seed (within budget) starts the climb; empty build otherwise.
    let start: EvaluatedBuild | null = null;
    for (const seed of seeds) {
      const ev = this.evalG(seed);
      if (ev.score.points > cfg.budget) continue;
      this.pushTop(ev);
      if (!start || ev.score.total > start.score.total) start = ev;
    }
    if (!start) start = this.evalG({});
    this.cur = start;
    this.best = start;
    this.pushTop(start);
  }

  get elapsedMs(): number {
    return Date.now() - this.startedAt;
  }

  get finished(): boolean {
    return this.noCandidates || this.stoppedByPlateau || this.elapsedMs >= this.cfg.timeMs;
  }

  /** Run up to `iterations` simulations (bounded by the time budget). */
  step(iterations: number): void {
    for (let i = 0; i < iterations; i++) {
      const elapsed = this.elapsedMs;
      if (elapsed >= this.cfg.timeMs || this.noCandidates) return;

      // Hard-plateau early stop: past 55% of the budget with no improvement
      // for 45% of the budget -> more time will very likely not help.
      if (elapsed > this.cfg.timeMs * 0.55 && elapsed - (this.bestAt - this.startedAt) > this.cfg.timeMs * 0.45) {
        this.stoppedByPlateau = true;
        return;
      }

      // Draw a valid neighbor (a few attempts — some ops don't apply).
      let neighbor: Genome | null = null;
      for (let t = 0; t < 4 && !neighbor; t++) neighbor = mutate(this.cur.genome, this.cands, this.nodesByCand, this.rng, this.cfg.baseline);
      if (!neighbor) continue;

      const ev = this.evalG(neighbor);
      this.sims++;

      if (ev.score.points > this.cfg.budget) continue; // over budget -> reject

      const better =
        ev.score.total > this.cur.score.total ||
        (ev.score.total === this.cur.score.total && ev.score.points < this.cur.score.points);
      // Tiny random-walk acceptance keeps the climb from wedging in corners.
      if (better || this.rng() < 0.02) this.cur = ev;

      if (ev.score.total > this.best.score.total) {
        this.best = ev;
        this.bestAt = Date.now();
        this.simsAtImprove = this.sims;
        this.pushTop(ev);
      } else if (ev.score.total > 0) {
        this.pushTop(ev);
      }

      // Soft plateau -> restart from a kicked copy of the best build.
      if (this.sims - this.simsAtImprove > RESTART_AFTER) {
        this.cur = this.evalG(perturb(this.best.genome, this.cands, this.nodesByCand, this.rng, this.cfg.baseline));
        this.simsAtImprove = this.sims;
      }
    }
  }

  progress(): SearchProgress {
    return { sims: this.sims, elapsedMs: this.elapsedMs, best: this.best.score.total };
  }

  outcome(): SearchOutcome {
    const top = [...this.top.values()].sort((a, b) => b.score.total - a.score.total).slice(0, TOP_K);
    return {
      top,
      sims: this.sims,
      elapsedMs: this.elapsedMs,
      bestAtMs: this.bestAt - this.startedAt,
      stoppedByPlateau: this.stoppedByPlateau,
    };
  }

  // ---- internals ----

  private evalG(genome: Genome): EvaluatedBuild {
    const hash = hashGenome(genome);
    const cached = this.cache.get(hash);
    if (cached) return { genome, hash, score: cached };
    const points = genomeCost(genome, this.cfg.baseline);
    const score = scoreGenome(genome, this.cfg.weights, points);
    if (this.cache.size < CACHE_MAX) this.cache.set(hash, score);
    return { genome, hash, score };
  }

  private pushTop(ev: EvaluatedBuild): void {
    if (ev.score.points > this.cfg.budget) return;
    if (this.top.has(ev.hash)) return;
    this.top.set(ev.hash, ev);
    if (this.top.size > TOP_K * 3) {
      // trim to the best TOP_K*2 to keep the map small
      const keep = [...this.top.values()].sort((a, b) => b.score.total - a.score.total).slice(0, TOP_K * 2);
      this.top = new Map(keep.map((e) => [e.hash, e]));
    }
  }
}
