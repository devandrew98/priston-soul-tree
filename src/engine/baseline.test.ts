// Baseline = nodes já abertas no jogo (custo afundado + piso de nível).
// Garante: custo conta os pontos presos, níveis nunca abaixam, o filler
// reaproveita os nodes abertos e a busca respeita tudo dentro do orçamento.
import { describe, it, expect } from 'vitest';
import { SearchEngine } from './search';
import { bestGreedyGenome } from './controller';
import { fillGenome } from './filler';
import { evaluate } from './genome';
import { genomeCost, openSetFor } from './pathfinder';
import type { EngineConfig } from './types';

const W = { attackPower: 100, critRate: 30 };
// Baseline realista: espinha até cv_4 (lendária uti nível alto) + um atk lateral.
// cv_4 nível 10 = o caso do usuário: pontos presos num node que a build "do zero"
// talvez nem usasse.
const BASELINE: Record<string, number> = { t1: 1, t2: 1, h1_3: 1, cv_3: 3, cv_4: 10, h1_2: 5 };

const mk = (extra?: Partial<EngineConfig>): EngineConfig => ({
  weights: W,
  inventory: {},
  allSouls: true,
  includePvp: false,
  budget: 217,
  timeMs: 300,
  rngSeed: 7,
  baseline: BASELINE,
  ...extra,
});

const baselineCost = genomeCost({}, BASELINE);

describe('Baseline (nodes já abertas no jogo)', () => {
  it('o custo de um genoma vazio é exatamente o já investido', () => {
    // t1(1)+t2(1)+h1_3 rare(2×1)+cv_3(3)+cv_4 leg(3×10)+h1_2(5) = 1+1+2+3+30+5 = 42
    expect(baselineCost).toBe(42);
    expect(genomeCost({})).toBe(0); // sem baseline continua zero
  });

  it('todo node do baseline permanece aberto em qualquer build gerada', () => {
    const g = bestGreedyGenome(mk());
    const open = openSetFor(g, BASELINE);
    for (const id of Object.keys(BASELINE)) expect(open.has(id)).toBe(true);
  });

  it('níveis nunca ficam abaixo do piso investido e o orçamento é respeitado', () => {
    const engine = new SearchEngine(mk(), [bestGreedyGenome(mk())]);
    while (!engine.finished) engine.step(500);
    const top = engine.outcome().top;
    expect(top.length).toBeGreaterThan(0);
    for (const b of top) {
      expect(b.score.points).toBeLessThanOrEqual(217);
      expect(b.score.points).toBeGreaterThanOrEqual(baselineCost); // afundado sempre conta
      for (const [id, gene] of Object.entries(b.genome)) {
        const floor = BASELINE[id];
        if (floor) expect(gene.nodeLevel).toBeGreaterThanOrEqual(floor);
      }
    }
  });

  it('o filler coloca souls nos nodes já abertos NO nível investido (pontos presos viram valor)', () => {
    const { genome } = fillGenome({}, mk());
    // cv_4 (uti lendária, nível 10 preso) tem soul de support compatível → deve ser preenchida
    expect(genome['cv_4']).toBeTruthy();
    expect(genome['cv_4'].nodeLevel).toBe(10);
    // e o custo não muda por preencher no piso (só sobe pelo leftover-leveling)
    expect(genomeCost(genome, BASELINE)).toBeLessThanOrEqual(217);
  });

  it('com baseline a build final nunca perde para a estratégia "só aproveitar o aberto"', () => {
    const onlyReuse = evaluate(fillGenome({}, mk()).genome, W, BASELINE);
    const best = evaluate(bestGreedyGenome(mk()), W, BASELINE);
    expect(best.score.total).toBeGreaterThanOrEqual(onlyReuse.score.total);
  });

  it('sem a opção marcada (baseline undefined) nada muda no comportamento', () => {
    const g1 = bestGreedyGenome(mk({ baseline: undefined, timeMs: 0 }));
    const ev = evaluate(g1, W);
    expect(ev.score.points).toBeLessThanOrEqual(217);
    // custo sem baseline não tem piso: um genoma vazio custa 0
    expect(genomeCost({}, undefined)).toBe(0);
  });
});
