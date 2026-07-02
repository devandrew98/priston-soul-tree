import { useMemo, useState } from 'react';
import { optimize, type Goal } from '../lib/optimizer';
import { RARITY_LABEL, fmt } from '../lib/formula';
import { computeTotals, slotStatValues } from '../lib/calc';
import { TREE_NODE_BY_ID, NODE_CATEGORY } from '../lib/tree';
import { SOULS, SOULS_BY_ID, CATEGORY_LABEL } from '../lib/souls';
import { useStore, totalFusionPoints } from '../store';
import { HelpTip } from './HelpTip';

// Curated, short list of the attributes the player distributes across.
// `scale` normalizes each stat so a % means a comparable amount of the build
// (percent stats like Critical are tiny numbers, flat stats are big).
const ATTRS: { key: string; label: string; scale: number }[] = [
  { key: 'attackPower', label: 'Attack Power', scale: 1 },
  { key: 'attackRating', label: 'Attack Rating', scale: 0.6 },
  { key: 'critRate', label: 'Critical', scale: 30 },
  { key: 'defense', label: 'Defense', scale: 1 },
  { key: 'absorb', label: 'Absorb', scale: 3 },
  { key: 'hp', label: 'HP', scale: 0.3 },
  { key: 'mana', label: 'Mana', scale: 0.3 },
  { key: 'evade', label: 'Evade', scale: 40 },
  { key: 'block', label: 'Block', scale: 40 },
  { key: 'exp', label: 'EXP', scale: 6 },
  { key: 'moveSpeed', label: 'Run Speed', scale: 8 },
  { key: 'stamina', label: 'Stamina', scale: 0.3 },
];
const LABEL: Record<string, string> = Object.fromEntries(ATTRS.map((a) => [a.key, a.label]));
const SCALE: Record<string, number> = Object.fromEntries(ATTRS.map((a) => [a.key, a.scale]));

// Quick starting points that just fill the sliders (the player can then tweak).
const QUICK: { name: string; pct: Record<string, number>; pvp?: boolean }[] = [
  { name: '⚔️ Ataque', pct: { attackPower: 70, critRate: 30 } },
  { name: '🛡️ Tank', pct: { defense: 30, absorb: 40, hp: 30 } },
  { name: '🌾 Farm', pct: { exp: 60, hp: 20, absorb: 20 } },
  { name: '⚔ PvP', pct: { attackPower: 40, defense: 20, absorb: 20, evade: 20 }, pvp: true },
];

export function Optimizer() {
  const { inventory, applySlots, activeBuild, fusionLevel } = useStore();
  const [pct, setPct] = useState<Record<string, number>>({});
  const [useBudget, setUseBudget] = useState(true);
  const [allSouls, setAllSouls] = useState(false);
  const [includePvp, setIncludePvp] = useState(false);

  const budget = totalFusionPoints(fusionLevel);
  const ownedCount = Object.keys(inventory).length;
  const total = Object.values(pct).reduce((a, b) => a + (b || 0), 0);

  const goal: Goal = useMemo(() => {
    const weights: Record<string, number> = {};
    for (const a of ATTRS) if (pct[a.key]) weights[a.key] = pct[a.key] * a.scale;
    return { id: 'custom', name: 'Personalizado', weights, includePvp, custom: true };
  }, [pct, includePvp]);

  const result = useMemo(
    () => optimize(goal, inventory, { budget: useBudget ? budget : undefined, allSouls }),
    [goal, inventory, useBudget, budget, allSouls],
  );

  const previewBuild = { ...activeBuild, slots: result.slots };
  const totals = computeTotals(previewBuild);
  const overBudget = result.pointsSpent > budget;

  const notes = useMemo(
    () => feedback(result, pct, inventory, allSouls),
    [result, pct, inventory, allSouls],
  );

  const setAttr = (key: string, v: number) => setPct((p) => ({ ...p, [key]: Math.max(0, Math.min(100, Math.round(v))) }));

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 8 }}>
        <strong style={{ color: 'var(--gold-bright)', fontSize: 16 }}>🤖 Gerador de Build (IA)</strong>
        <span className="spacer" />
        <span className="muted">{ownedCount} souls no inventário</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Distribua a importância entre os atributos que você quer (não precisa somar 100). A IA monta a build
        mais próxima possível, respeitando suas souls, os nodes e o limite de pontos — e te explica o que dá ou não dá.
      </p>

      {ownedCount === 0 && !allSouls && (
        <p className="warn">⚠️ Você não marcou souls no <b>Inventário</b>. Marque as suas (ou ligue "Considerar todas as souls" abaixo) pra IA gerar algo.</p>
      )}

      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        <span className="muted">Atalhos:</span>
        {QUICK.map((q) => (
          <button key={q.name} className="btn sm" onClick={() => { setPct(q.pct); if (q.pvp) setIncludePvp(true); }}>{q.name}</button>
        ))}
        <button className="btn sm" onClick={() => setPct({})}>Limpar</button>
      </div>

      <div className="attr-sliders">
        {ATTRS.map((a) => (
          <div className={`attr-row ${pct[a.key] ? 'on' : ''}`} key={a.key}>
            <span className="attr-label">{a.label}</span>
            <input className="attr-range" type="range" min={0} max={100} value={pct[a.key] || 0} onChange={(e) => setAttr(a.key, Number(e.target.value))} />
            <input className="input attr-num" type="number" min={0} max={100} value={pct[a.key] || 0} onChange={(e) => setAttr(a.key, Number(e.target.value))} />
            <span className="attr-pct">%</span>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 10, marginTop: 10 }}>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={useBudget} onChange={(e) => setUseBudget(e.target.checked)} /> Respeitar limite ({budget} pts)
        </label>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={allSouls} onChange={(e) => setAllSouls(e.target.checked)} /> Considerar todas as souls
        </label>
        <HelpTip text="Ligado: a IA ignora seu inventário e monta a melhor build teórica com QUALQUER soul do jogo — bom pra descobrir souls que valeria a pena conseguir." />
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={includePvp} onChange={(e) => setIncludePvp(e.target.checked)} /> Incluir PvP
        </label>
        <span className="spacer" />
        <button className="btn primary" disabled={result.used.length === 0} onClick={() => applySlots(result.slots)}>✓ Aplicar</button>
      </div>

      <div className="points-meta" style={{ marginTop: 10 }}>
        <span>Nodes usados <b>{result.used.length}</b></span>
        <span className={overBudget ? 'over-txt' : ''}>Pontos <b>{result.pointsSpent}</b> / {budget}</span>
      </div>

      {total > 0 && notes.length > 0 && (
        <div className="ai-feedback">
          <div className="total-sub">🧠 Feedback da IA</div>
          {notes.map((n, i) => <p key={i} className="ai-note">{n}</p>)}
        </div>
      )}

      <hr className="sep" />

      <div className="opt-grid">
        <div>
          <div className="total-sub">Plano de montagem ({result.used.length} nodes · {result.pointsSpent} pts)</div>
          {result.used.length === 0 && <p className="muted">Distribua os atributos acima pra gerar a build.</p>}
          {result.used
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((u) => {
              const s = SOULS_BY_ID[u.soulId];
              const node = TREE_NODE_BY_ID[u.slotId];
              const cat = NODE_CATEGORY[node.type];
              const nodeLabel = cat === 'wildcard' ? 'Wildcard' : CATEGORY_LABEL[cat];
              const svs = slotStatValues(result.slots[u.slotId], u.nodeRarity);
              return (
                <div className="total-row" key={u.slotId}>
                  <span className="lbl">
                    {s.name} <span className="muted">→ {nodeLabel}</span>{' '}
                    <span className={`rarity-tag ${u.nodeRarity}`}>{RARITY_LABEL[u.nodeRarity]}</span>{' '}
                    <span className="muted">Lv{u.nodeLevel} · {u.points} pts</span>
                  </span>
                  <span className="val">{svs.map((sv) => `+${fmt(sv.value, sv.unit)}`).join(' / ')}</span>
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

/** Compare what the build achieved with what was asked, and explain the gaps. */
function feedback(
  result: ReturnType<typeof optimize>,
  pct: Record<string, number>,
  inv: Record<string, number>,
  allSouls: boolean,
): string[] {
  const requested = Object.entries(pct).filter(([, v]) => v > 0);
  if (!requested.length) return [];
  const totalReq = requested.reduce((s, [, v]) => s + v, 0) || 1;

  // Scaled contribution achieved per targeted stat.
  const achieved: Record<string, number> = {};
  for (const u of result.used) {
    for (const sv of slotStatValues(result.slots[u.slotId], u.nodeRarity)) {
      if (pct[sv.stat]) achieved[sv.stat] = (achieved[sv.stat] || 0) + sv.value * (SCALE[sv.stat] || 1);
    }
  }
  const totalAch = Object.values(achieved).reduce((a, b) => a + b, 0) || 1;

  const msgs: string[] = [];
  for (const [stat, reqVal] of requested.sort((a, b) => b[1] - a[1])) {
    const reqShare = Math.round((reqVal / totalReq) * 100);
    const achShare = Math.round(((achieved[stat] || 0) / totalAch) * 100);
    if (achShare >= reqShare - 8) continue; // close enough

    const souls = SOULS.filter((s) => s.stats.some((st) => st.stat === stat) && (allSouls || inv[s.id]));
    if (!souls.length) {
      msgs.push(`❌ ${LABEL[stat]}: você pediu ~${reqShare}%, mas ${allSouls ? 'não existe soul desse atributo compatível' : 'você não tem nenhuma soul desse atributo — marque no Inventário'}.`);
      continue;
    }
    const maxLvl = Math.max(...souls.map((s) => (allSouls ? 3 : inv[s.id] || 0)));
    if (maxLvl < 3) {
      msgs.push(`⚠️ ${LABEL[stat]}: pediu ~${reqShare}%, chegou em ~${achShare}%. Suas souls de ${LABEL[stat]} estão no nível ${maxLvl} — subir pra nível 3 (juntando cópias) e investir mais pontos nesses nodes aumentaria bastante.`);
    } else {
      msgs.push(`⚠️ ${LABEL[stat]}: pediu ~${reqShare}%, chegou em ~${achShare}%. Limitado pelos pontos/nodes — os outros atributos disputam o mesmo espaço. Aumente o % dele (ou o Nível de Fusão) pra priorizar.`);
    }
  }
  if (!msgs.length) msgs.push('✅ A build ficou bem próxima da distribuição que você pediu!');
  return msgs;
}
