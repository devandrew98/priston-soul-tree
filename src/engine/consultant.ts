// AIConsultant — RecommendationEngine + ExplainabilityEngine + PromptBuilder.
// The AI layer NEVER creates builds: it interprets the player's goal, explains
// what the OptimizationEngine found and recommends next steps. It returns
// i18n TOKENS ({key, vars}) so the UI renders them in the site language.
// PromptBuilder produces the exact prompt a future LLM integration would use
// (documented dependency: a paid LLM API — plug point only for now).

import { SOULS_BY_ID } from '../lib/souls';
import type { EngineConfig, SolverResult } from './types';
import { candidateSouls } from './genome';

export interface AdviceToken {
  key: string;
  vars?: Record<string, string | number>;
}

/** ExplainabilityEngine — why this result, how confident, what shaped it. */
export function explainResult(res: SolverResult): AdviceToken[] {
  const tokens: AdviceToken[] = [];
  const best = res.top[0];
  if (!best || best.score.total <= 0) return [{ key: 'ai2.ex.none' }];

  tokens.push({
    key: 'ai2.ex.summary',
    vars: {
      sims: res.sims.toLocaleString(),
      s: (res.elapsedMs / 1000).toFixed(1),
      score: Math.round(best.score.total).toLocaleString(),
      nodes: Object.keys(best.genome).length,
      pts: best.score.points,
    },
  });

  const tot = best.score.total || 1;
  tokens.push({
    key: 'ai2.ex.breakdown',
    vars: {
      off: Math.round((100 * best.score.offense) / tot),
      def: Math.round((100 * best.score.defense) / tot),
      uti: Math.round((100 * best.score.utility) / tot),
    },
  });

  if (res.filled > 0) tokens.push({ key: 'ai2.ex.filled', vars: { n: res.filled } });
  if (res.filledSurvival > 0) tokens.push({ key: 'ai2.ex.survival', vars: { n: res.filledSurvival } });

  if (res.seedScore > 0) {
    const gain = ((best.score.total - res.seedScore) / res.seedScore) * 100;
    if (gain >= 0.5) tokens.push({ key: 'ai2.ex.vsgreedy', vars: { pct: gain.toFixed(1) } });
    else tokens.push({ key: 'ai2.ex.samegreedy' });
  }

  tokens.push({ key: res.stoppedByPlateau || res.confidence >= 70 ? 'ai2.ex.plateau' : 'ai2.ex.timeup' });
  if (res.fromKnowledge) tokens.push({ key: 'ai2.ex.kb' });
  return tokens;
}

/** RecommendationEngine — concrete next steps that would raise the score. */
export function recommend(res: SolverResult, cfg: EngineConfig): AdviceToken[] {
  const out: AdviceToken[] = [];
  const best = res.top[0];
  if (!best) return out;

  // Souls used below level 3: merging copies raises the same build directly.
  const seen = new Set<string>();
  for (const g of Object.values(best.genome)) {
    if (g.soulLevel >= 3 || seen.has(g.soulId)) continue;
    seen.add(g.soulId);
    const name = SOULS_BY_ID[g.soulId]?.name;
    if (name) out.push({ key: 'ai2.rec.levelup', vars: { name, lvl: g.soulLevel } });
    if (out.length >= 2) break;
  }

  // Strongest souls for this goal the player does NOT own yet.
  if (!cfg.allSouls) {
    const all = candidateSouls({ ...cfg, allSouls: true });
    let added = 0;
    for (const c of all) {
      if (cfg.inventory[c.soulId]) continue;
      const name = SOULS_BY_ID[c.soulId]?.name;
      if (name) {
        out.push({ key: 'ai2.rec.acquire', vars: { name } });
        added++;
      }
      if (added >= 2) break;
    }
  }
  return out.slice(0, 4);
}

/**
 * PromptBuilder — the structured prompt a future LLM consultant would receive.
 * Kept in English (LLMs handle it best); unused by the UI today.
 */
export function buildPrompt(cfg: EngineConfig, res: SolverResult): string {
  const best = res.top[0];
  const weights = Object.entries(cfg.weights)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  const build = best
    ? Object.entries(best.genome)
        .map(([node, g]) => `${node}: ${SOULS_BY_ID[g.soulId]?.name ?? g.soulId} (SL${g.soulLevel}, NL${g.nodeLevel})`)
        .join('; ')
    : 'none';
  return [
    'You are a Priston Tale EU Soul Tree consultant. The math solver already produced the build below.',
    'Explain it to the player and suggest improvements. Do NOT invent a different build.',
    `Goal weights: ${weights || 'none'}. Budget: ${cfg.budget} fusion points. PvP: ${cfg.includePvp}.`,
    `Solver result: score=${best ? Math.round(best.score.total) : 0}, points=${best?.score.points ?? 0}, sims=${res.sims}, confidence=${res.confidence}%.`,
    `Build: ${build}`,
  ].join('\n');
}
