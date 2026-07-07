# PROJECT_STATE.md — Priston Soul Tree · Motor de IA (Solver)

> Fonte única da verdade do estado do projeto. Atualizado a cada sessão de desenvolvimento.
> Última atualização: 2026-07-07.

---

# Estado Atual

## Fase Atual

**Fases 1–9, 11 e 12 CONCLUÍDAS** (com escopos adaptados ao contexto do projeto — ver "Decisões arquiteturais").
**Fase 10 (Vision/OCR) NÃO iniciada** — documentada como dependência futura.

O site está NO AR em https://priston-soul-tree.vercel.app (GitHub `devandrew98/priston-soul-tree` → Vercel; cada push na `main` re-deploya).

---

## Arquitetura

### Visão geral

```
┌─────────────────────────── Navegador (client-side) ───────────────────────────┐
│                                                                                │
│  UI (React)                    Motor (TypeScript puro, sem DOM)                │
│  ┌──────────────┐   config    ┌──────────────────────────────────────────┐    │
│  │ Optimizer.tsx│ ──────────▶ │ controller.ts (SearchController)          │    │
│  │  sliders %   │             │   ├─ seed 1: lib/optimizer (greedy)       │    │
│  │  busca prof. │ ◀────────── │   ├─ seed 2: KnowledgeBase (aprendizado)  │    │
│  │  top builds  │  progresso/ │   ├─ N× Web Worker (paralelismo real)     │    │
│  │  análise IA  │  resultado  │   │    └─ worker.ts → SearchEngine        │    │
│  └──────────────┘             │   ├─ merge + confiança                    │    │
│                               │   └─ KnowledgeBase.save (aprende)         │    │
│                               └──────────────────────────────────────────┘    │
│                                                                                │
│  SearchEngine (search.ts) = OptimizationEngine + SimulationEngine              │
│    hill-climbing estocástico + restarts | TimeBudget | Plateau Detection       │
│    CacheEngine (memo hash→score) | top-K distintas                             │
│                                                                                │
│  scoring.ts (ScoringEngine)   pathfinder.ts (PathFinder)   genome.ts (domínio) │
│  consultant.ts (AIConsultant/Explainability/Recommendation/PromptBuilder)      │
│  knowledge.ts (KnowledgeBase + StatisticsEngine, localStorage)                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Estrutura de pastas

```
src/
  engine/            ← O MOTOR (TypeScript puro; roda em Worker, browser e Node/testes)
    types.ts         ← contratos públicos (EngineConfig, Genome, ScoreBreakdown, SolverResult…)
    rng.ts           ← PRNG determinístico (mulberry32) — buscas reprodutíveis por seed
    scoring.ts       ← ScoringEngine: build → Score único + breakdown ofensa/defesa/utilidade
    pathfinder.ts    ← PathFinder: custo EXATO da build sob as regras de desbloqueio
    genome.ts        ← domínio do solver: representação esparsa, candidatos, hash, 7 mutações válidas
    search.ts        ← SearchEngine (Optimization+Simulation): hill-climb, TimeBudget, Plateau, cache, top-K
    knowledge.ts     ← KnowledgeBase + StatisticsEngine (storage injetável)
    consultant.ts    ← AIConsultant: explainResult, recommend, buildPrompt (tokens i18n)
    worker.ts        ← entry do Web Worker (1 SearchEngine por núcleo)
    controller.ts    ← SearchController: orquestra workers, merge, confiança, fallback inline
    *.test.ts        ← suíte de testes (vitest): 17 testes + benchmark com guarda de regressão
  lib/               ← domínio do jogo (Fases 1–2, já existiam e foram reaproveitadas)
    types.ts         ← Soul, SoulStat, SlotState, Build, Inventory, Rarity, Category
    tree.ts          ← 36 nodes, raridades, compatibilidades (acceptsSoul), custos
    graph.ts         ← grafo da árvore: Dijkstra node-weighted + Steiner guloso (OTIMIZADO: typed arrays)
    formula.ts       ← fórmula oficial do node Fusion Tier
    calc.ts          ← totais/custos de uma Build (UI)
    optimizer.ts     ← gerador rápido greedy (agora também é o SEED da busca profunda)
    souls.ts/data    ← 111 souls raspadas da wiki (modelo multi-atributo)
    i18n.tsx         ← dicionário PT/EN (inclui todas as strings do solver)
  components/        ← UI React (Planner, Optimizer, Inventory, TimeBoss…)
api/                 ← serverless Vercel (build share + player sync, Upstash Redis)
```

### Responsabilidades e comunicação

| Módulo | Responsabilidade | Comunica com |
|---|---|---|
| `types.ts` | Contratos públicos do motor | todos |
| `scoring.ts` | Score único por build (+breakdown) | search, genome |
| `pathfinder.ts` | Custo exato/conectividade (regras do jogo) | genome, search |
| `genome.ts` | Espaço de busca: candidatos, mutações, conversões | search, controller, UI |
| `search.ts` | Loop de otimização (sim, aceita/descarta, platô, cache) | worker, controller |
| `knowledge.ts` | Persistir melhor build por perfil + estatísticas | controller, testes |
| `consultant.ts` | Explicar/recomendar (tokens i18n) + prompt p/ LLM futuro | UI |
| `worker.ts` | Rodar 1 SearchEngine fora da thread da UI | controller (postMessage) |
| `controller.ts` | API pública `deepOptimize(cfg, onProgress)` | UI |

**Interface pública do motor (única porta de entrada da UI):**
`deepOptimize(config: EngineConfig, onProgress?) → Promise<SolverResult>` + `genomeToSlots()` p/ aplicar na árvore + `explainResult()/recommend()` p/ os textos.

**Protocolo worker:** `WorkerRequest {config, seeds}` → mensagens `{type:'progress'}` (a cada ~200ms) e `{type:'done', outcome}`.

### Padrões de projeto e justificativas

- **Motor puro, UI burra**: `src/engine/` não importa React/DOM → roda idêntico em Worker, browser e Node (testes). Justificativa: testabilidade e paralelismo sem duplicação.
- **Strategy/Facade**: `pathfinder.ts` e `scoring.ts` são fachadas únicas — trocar a fórmula/regra num lugar só.
- **Injeção de dependência**: `KnowledgeBase(storage)` recebe o storage (localStorage real ou Map nos testes).
- **Determinismo**: RNG semeado; cada worker recebe `rngSeed` distinto (`seed + i*7919`).
- **Tokens i18n em vez de strings**: o consultor devolve `{key, vars}`; a UI resolve com `t()` — o motor não conhece idioma.
- **Fallback gracioso**: sem Worker (navegador restrito) → `runInline` com chunks async (UI não trava, feature nunca quebra).
- **A IA não cria builds** (decisão do usuário, Fase 8): quem decide é o OptimizationEngine (matemática); a camada "IA" interpreta objetivo, explica e recomenda.

---

## O que já foi concluído (por fase)

- **F1 Arquitetura** ✅ — estrutura `src/engine/` + este documento.
- **F2 Domínio** ✅ — já existia em `lib/` (Soul multi-atributo, 36 nodes, raridades, compatibilidades `acceptsSoul`, limites de pontos); o motor adicionou `Genome` (representação esparsa p/ busca).
- **F3 ScoringEngine** ✅ — score único ponderado + breakdown ofensa/defesa/utilidade + eficiência/ponto; pesos vêm dos sliders (% × escala por stat).
- **F4 PathFinder** ✅ — já existia (`graph.ts`: Dijkstra node-weighted, Steiner guloso); ganhou fachada `genomeCost` com teste de equivalência às regras do jogo, e foi **reescrito com typed arrays** (ver F11).
- **F5 OptimizationEngine** ✅ — `SearchEngine`: hill-climbing estocástico, aceitação com random-walk 2%, restarts (kick após 2.200 sims sem melhora), **TimeBudget** rígido, **Plateau Detection** (para cedo se >55% do tempo e 45% sem melhora), SearchState completo.
- **F6 SimulationEngine** ✅ — milhares de builds geradas (7 mutações válidas), comparadas (score), descartadas (rejeição por orçamento/pior), rankeadas (**top-K distintas por hash**), medidas (**~30.000 builds/segundo** no total; 193k–240k por rodada de 7-8s).
- **F7 Cache + KnowledgeBase** ✅ — CacheEngine (memoização hash→score in-run, cap 60k); **KnowledgeBase** (melhor build por perfil de pergunta em localStorage; novas buscas seedam dela — **aprendizado comprovado**: 57.679 → 57.872 → 57.893 em rodadas sucessivas); **StatisticsEngine** (runs/sims/ms/bestEver acumulados).
- **F8 IA** ✅ — `AIConsultant`: **ExplainabilityEngine** (resumo, breakdown, ganho vs greedy, platô/tempo, uso de conhecimento), **RecommendationEngine** (subir soul pra Lv3; souls que valem caçar), **PromptBuilder** (prompt pronto p/ LLM futuro). IA **não** cria builds.
- **F9 UX** ✅ — seção "🚀 Busca profunda" no Gerador: seletor de tempo (3/8/20s), barra de progresso ao vivo (builds testadas + melhor score), **badge de confiança (%)**, **Top 5 builds** com Aplicar (1 clique → árvore), Análise da IA e Recomendações — tudo bilíngue PT/EN.
- **F11 Performance** ✅ — benchmark identificou o gargalo (Steiner: 0,94ms/avaliação); reescrito com **arrays tipados indexados por inteiro** → 8,6× mais rápido (~0,11ms); paralelismo por **Web Workers** (min(4, núcleos−1)); cache de avaliação; guarda de regressão no teste de benchmark.
- **F12 Testes** ✅ — **17 testes + benchmark (vitest, `npm test`)**: scoring (determinismo, monotonicidade, pesos), genome (hash estável, roundtrip, 300 mutações válidas, **equivalência genomeCost ≡ pointsSpent**), search (milhares de sims, orçamento nunca estourado, nunca perde pro seed, respeita tempo, caso sem candidatos), knowledge (perfil, roundtrip, só-melhor, estatísticas).

## O que ainda falta (com dependências documentadas)

| Item | Fase | Dependência / decisão pendente |
|---|---|---|
| Vision/OCR (upload de screenshot da árvore → reconhecimento → comparação) | F10 | Biblioteca OCR client-side (tesseract.js) ou API de visão paga; template-matching dos 474 ícones. Fase inteira própria. |
| LLM conversacional real (chat com o jogador) | F8+ | API paga (decisão do usuário: manter site gratuito). `buildPrompt()` já deixa o plug pronto. |
| KnowledgeBase compartilhada entre jogadores (Redis) | F7+ | Endpoint serverless novo (`api/knowledge.ts`) + Upstash; hoje o aprendizado é por navegador. |
| Redis/fila/GPU para o solver | F11 | **Descartado por decisão arquitetural**: site estático gratuito → o paralelismo certo é Web Worker no cliente (implementado). |
| Comparação lado-a-lado de 2 builds, gráficos, ranking/comunidade, API pública, plugins, mobile/desktop nativo | Futuro | Brainstorming registrado; nada bloqueia. |
| Determinismo estrito da busca (budget por iterações, não por tempo) | Melhoria | Facilita testes A/B de estratégias. |

## Métricas medidas (nesta máquina, build de produção)

- **~30.000 builds/s** agregadas (3 workers) · 193k–240k builds por rodada de 7–8s.
- Avaliação: ~0,11ms/build (era 0,94ms antes da otimização — 8,6×).
- **Busca profunda superou o gerador rápido em +8,8%** no objetivo Ataque/Crítico (214 pts).
- Platô detectado encerrou rodada de 8s em 6,7s (economia real de tempo).
- 17/17 testes verdes; bundle do worker: 33,7 kB.

## Como rodar

- `npm run build` — typecheck + build (emite o worker como chunk próprio).
- `npm test` — suíte vitest (inclui benchmark com guarda de regressão).
- Site: aba **🤖 Gerador (IA)** → distribuir % → **🚀 Busca profunda**.
