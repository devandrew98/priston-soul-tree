import { useMemo, useState } from 'react';
import { optimize, PRESET_GOALS, type Goal } from '../lib/optimizer';
import { RARITY_LABEL, fmt } from '../lib/formula';
import { computeTotals } from '../lib/calc';
import { TREE_NODE_BY_ID, NODE_CATEGORY } from '../lib/tree';
import { SOULS_BY_ID, STAT_META, ALL_STATS, CATEGORY_LABEL } from '../lib/souls';
import { useStore, totalFusionPoints } from '../store';

export function Optimizer() {
  const { inventory, applySlots, activeBuild, fusionLevel } = useStore();
  const [goalId, setGoalId] = useState<string>(PRESET_GOALS[0].id);
  const [useBudget, setUseBudget] = useState(true);
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({});
  const [customPvp, setCustomPvp] = useState(false);

  const budget = totalFusionPoints(fusionLevel);
  const ownedCount = Object.keys(inventory).length;

  const goal: Goal = useMemo(() => {
    if (goalId === 'custom') {
      const weights: Record<string, number> = {};
      for (const [k, v] of Object.entries(customWeights)) if (v) weights[k] = v;
      return { id: 'custom', name: 'Objetivo personalizado', weights, includePvp: customPvp, custom: true };
    }
    return PRESET_GOALS.find((g) => g.id === goalId)!;
  }, [goalId, customWeights, customPvp]);

  const result = useMemo(
    () => optimize(goal, inventory, { budget: useBudget ? budget : undefined }),
    [goal, inventory, useBudget, budget],
  );

  const previewBuild = { ...activeBuild, slots: result.slots };
  const totals = computeTotals(previewBuild);
  const overBudget = result.pointsSpent > budget;

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 12 }}>
        <strong style={{ color: 'var(--gold-bright)', fontSize: 16 }}>🤖 Gerador de Build (IA)</strong>
        <span className="spacer" />
        <span className="muted">{ownedCount} souls no inventário</span>
      </div>

      {ownedCount === 0 && (
        <p className="warn">⚠️ Você ainda não marcou nenhuma soul como "tenho". Vá na aba <b>Inventário</b> e marque suas souls (com o nível) para a IA montar a build com o que você realmente possui.</p>
      )}

      <p className="muted" style={{ marginTop: 0 }}>
        Escolha um objetivo. A IA escolhe, entre as souls que você possui, em qual node colocar cada uma
        e <b>quantos pontos investir em cada node</b> para extrair o máximo do atributo desejado — respeitando
        categorias, raridade dos nodes, a fórmula do Fusion Tier e o seu limite de pontos.
      </p>

      <div className="opt-grid">
        {PRESET_GOALS.map((g) => (
          <div key={g.id} className={`goal-card ${g.id === goalId ? 'active' : ''}`} onClick={() => setGoalId(g.id)}>
            <h4>{g.name}{g.includePvp ? ' ⚔' : ''}</h4>
            <p className="muted">{describeWeights(g)}</p>
          </div>
        ))}
        <div className={`goal-card ${goalId === 'custom' ? 'active' : ''}`} onClick={() => setGoalId('custom')}>
          <h4>✎ Personalizado</h4>
          <p className="muted">{Object.values(customWeights).some((v) => v) ? describeWeights(goal) : 'Defina seus próprios pesos por atributo'}</p>
        </div>
      </div>

      {goalId === 'custom' && (
        <div className="custom-goal">
          <div className="total-sub">Pesos por atributo (0 = ignorar)</div>
          <div className="weight-grid">
            {ALL_STATS.map((s) => (
              <label key={s.key} className="weight-item">
                <span>{s.label}</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={0.5}
                  value={customWeights[s.key] ?? 0}
                  onChange={(e) => setCustomWeights((w) => ({ ...w, [s.key]: Number(e.target.value) }))}
                />
              </label>
            ))}
          </div>
          <label className="row" style={{ gap: 6, marginTop: 8 }}>
            <input type="checkbox" checked={customPvp} onChange={(e) => setCustomPvp(e.target.checked)} /> Incluir souls/nodes de PvP
          </label>
        </div>
      )}

      <hr className="sep" />

      <div className="row">
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={useBudget} onChange={(e) => setUseBudget(e.target.checked)} /> Respeitar limite de pontos ({budget} pts — Fusion Lv {fusionLevel})
        </label>
        <span className="spacer" />
        <button className="btn primary" disabled={result.used.length === 0} onClick={() => applySlots(result.slots)}>
          ✓ Aplicar na build atual
        </button>
      </div>

      <div className="points-meta" style={{ marginTop: 10 }}>
        <span>Nodes usados <b>{result.used.length}</b></span>
        <span className={overBudget ? 'over-txt' : ''}>Pontos <b>{result.pointsSpent}</b> / {budget}</span>
      </div>

      <hr className="sep" />

      <div className="opt-grid">
        <div>
          <div className="total-sub">Plano de montagem ({result.used.length} nodes · {result.pointsSpent} pts)</div>
          {result.used.length === 0 && <p className="muted">Nenhuma soul compatível encontrada para este objetivo.</p>}
          {result.used
            .slice()
            .sort((a, b) => b.value - a.value)
            .map((u) => {
              const s = SOULS_BY_ID[u.soulId];
              const node = TREE_NODE_BY_ID[u.slotId];
              const cat = NODE_CATEGORY[node.type];
              const nodeLabel = cat === 'wildcard' ? 'Wildcard' : CATEGORY_LABEL[cat];
              return (
                <div className="total-row" key={u.slotId}>
                  <span className="lbl">
                    {s.name} <span className="muted">→ node {nodeLabel}</span>{' '}
                    <span className={`rarity-tag ${u.nodeRarity}`}>{RARITY_LABEL[u.nodeRarity]}</span>{' '}
                    <span className="muted">Lv{u.nodeLevel} · {u.points} pts</span>
                  </span>
                  <span className="val">+{fmt(u.value, s.unit)}</span>
                </div>
              );
            })}
        </div>
        <div>
          <div className="total-sub">Resultado estimado</div>
          {totals.length === 0 && <p className="muted">—</p>}
          {totals.map((t) => (
            <div className="total-row" key={t.key + (t.isPvp ? 'p' : '')}>
              <span className="lbl">{t.label}{t.isPvp ? ' (PvP)' : ''}</span>
              <span className="val">+{fmt(t.value, t.unit)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function describeWeights(g: Goal): string {
  const entries = Object.entries(g.weights);
  if (entries.length === 0) return 'sem pesos definidos';
  return entries
    .map(([k, w]) => `${STAT_META[k]?.label ?? k} ×${w}`)
    .join('  ·  ');
}
