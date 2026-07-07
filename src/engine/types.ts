// Core types of the optimization engine ("the brain").
// The engine is pure TypeScript with NO React/DOM dependency so it can run
// inside Web Workers and in Node (tests) unchanged.

export type Weights = Record<string, number>; // stat key -> weight (already scaled)

export interface EngineConfig {
  weights: Weights;
  inventory: Record<string, number>; // soulId -> owned level (1..3); ignored when allSouls
  allSouls: boolean;
  includePvp: boolean;
  budget: number; // max fusion points
  timeMs: number; // time budget for the search
  rngSeed: number; // deterministic seed (each worker gets a different one)
}

/** One placed soul in a build. Keyed by node id in a Genome. */
export interface Gene {
  soulId: string;
  soulLevel: 1 | 2 | 3;
  nodeLevel: number;
}

/** Sparse build representation: only nodes that hold a soul. */
export type Genome = Record<string, Gene>;

export interface ScoreBreakdown {
  total: number;
  offense: number; // attack-family weighted contribution
  defense: number; // survivability-family weighted contribution
  utility: number; // everything else (exp, speed, mana...)
  points: number; // exact fusion points (unlock rules included)
  perPoint: number; // efficiency
}

export interface EvaluatedBuild {
  genome: Genome;
  hash: string;
  score: ScoreBreakdown;
}

export interface SearchProgress {
  sims: number;
  elapsedMs: number;
  best: number;
}

export interface SearchOutcome {
  top: EvaluatedBuild[]; // best distinct builds, sorted desc
  sims: number;
  elapsedMs: number;
  bestAtMs: number; // when the best build was found
  stoppedByPlateau: boolean;
}

export interface SolverResult extends SearchOutcome {
  confidence: number; // 0..100
  agreement: number; // 0..1 — share of workers that converged to ~the same score
  workers: number;
  fromKnowledge: boolean; // a previous run's best was reused as a seed
  seedScore: number; // score of the greedy seed (to measure the deep search's gain)
  filled: number; // pass-through nodes that received a soul in the fill pass
  filledSurvival: number; // of those, how many got a survivability soul
}

// ---- worker protocol ----
export interface WorkerRequest {
  config: EngineConfig;
  seeds: Genome[];
}

export type WorkerMessage =
  | { type: 'progress'; progress: SearchProgress }
  | { type: 'done'; outcome: SearchOutcome };
