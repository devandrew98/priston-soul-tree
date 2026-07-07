// KnowledgeBase + StatisticsEngine — accumulated intelligence across runs.
// Every finished search stores its best build under a profile key (weights +
// inventory + budget). New searches with the same profile reuse it as a seed,
// so the platform "learns": repeated questions start from the best known
// answer and only improve. Storage is injectable (localStorage in the browser,
// a Map in tests). Redis-backed sharing is a documented future phase.

import type { EngineConfig, EvaluatedBuild, Genome } from './types';

export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function memoryStorage(): KVStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

function defaultStorage(): KVStorage {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* workers / node have no localStorage */
  }
  return memoryStorage();
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Stable key for "the same question": weights + inventory + budget + flags. */
export function profileKey(cfg: EngineConfig): string {
  const w = Object.entries(cfg.weights)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${Math.round(v * 100) / 100}`)
    .sort()
    .join(',');
  const inv = cfg.allSouls
    ? 'ALL'
    : Object.entries(cfg.inventory)
        .map(([k, v]) => `${k}:${v}`)
        .sort()
        .join(',');
  return djb2(`${w}|${inv}|${cfg.budget}|${cfg.includePvp ? 1 : 0}`);
}

export interface KnowledgeEntry {
  genome: Genome;
  score: number;
  sims: number;
  savedAt: number;
}

export interface EngineStats {
  runs: number;
  sims: number;
  ms: number;
  bestEver: number;
}

const KB_PREFIX = 'ptai-kb:';
const STATS_KEY = 'ptai-kb:stats';

export class KnowledgeBase {
  constructor(private kv: KVStorage = defaultStorage()) {}

  load(cfg: EngineConfig): KnowledgeEntry | null {
    try {
      const raw = this.kv.getItem(KB_PREFIX + profileKey(cfg));
      if (!raw) return null;
      const e = JSON.parse(raw) as KnowledgeEntry;
      return e && e.genome ? e : null;
    } catch {
      return null;
    }
  }

  save(cfg: EngineConfig, best: EvaluatedBuild, sims: number): void {
    try {
      const prev = this.load(cfg);
      if (prev && prev.score >= best.score.total) return; // keep only the best known
      const e: KnowledgeEntry = { genome: best.genome, score: best.score.total, sims, savedAt: Date.now() };
      this.kv.setItem(KB_PREFIX + profileKey(cfg), JSON.stringify(e));
    } catch {
      /* quota / private mode — knowledge is a bonus, never an error */
    }
  }

  // ---- StatisticsEngine ----
  stats(): EngineStats {
    try {
      const raw = this.kv.getItem(STATS_KEY);
      if (raw) return JSON.parse(raw) as EngineStats;
    } catch {
      /* ignore */
    }
    return { runs: 0, sims: 0, ms: 0, bestEver: 0 };
  }

  recordRun(sims: number, ms: number, best: number): void {
    try {
      const s = this.stats();
      const nx: EngineStats = {
        runs: s.runs + 1,
        sims: s.sims + sims,
        ms: s.ms + ms,
        bestEver: Math.max(s.bestEver, best),
      };
      this.kv.setItem(STATS_KEY, JSON.stringify(nx));
    } catch {
      /* ignore */
    }
  }
}
