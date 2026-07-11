import { useMemo, useRef, useState } from 'react';
import { optimize, type Goal } from '../lib/optimizer';
import { RARITY_LABEL, fmt, MAX_FUSION_POINTS } from '../lib/formula';
import { computeTotals, slotStatValues } from '../lib/calc';
import { TREE_NODE_BY_ID, NODE_CATEGORY, RARITY_POINT_COST } from '../lib/tree';
import { SOULS, SOULS_BY_ID, CATEGORY_LABEL } from '../lib/souls';
import { useStore, totalFusionPoints } from '../store';
import { useI18n } from '../lib/i18n';
import { HelpTip } from './HelpTip';
import { deepOptimize, bestGreedyGenome, type DeepProgress } from '../engine/controller';
import { genomeToSlots } from '../engine/genome';
import { genomeCost } from '../engine/pathfinder';
import { explainResult, recommend, type AdviceToken } from '../engine/consultant';
import type { EngineConfig, SolverResult } from '../engine/types';

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
  { key: 'agingSuccess', label: 'Aging Success', scale: 30 },
  { key: 'ownItemType', label: 'Own Item Drop', scale: 5 },
  { key: 'ownSpecChance', label: 'Own Spec Chance', scale: 5 },
];
const LABEL: Record<string, string> = Object.fromEntries(ATTRS.map((a) => [a.key, a.label]));
const SCALE: Record<string, number> = Object.fromEntries(ATTRS.map((a) => [a.key, a.scale]));

// Quick starting points that just fill the sliders (the player can then tweak).
const QUICK: { id: string; pct: Record<string, number>; pvp?: boolean }[] = [
  { id: 'atk', pct: { attackPower: 70, critRate: 30 } },
  { id: 'tank', pct: { defense: 30, absorb: 40, hp: 30 } },
  { id: 'farm', pct: { exp: 60, hp: 20, absorb: 20 } },
  { id: 'aging', pct: { agingSuccess: 100 } },
  { id: 'item', pct: { ownItemType: 70, ownSpecChance: 30 } },
  { id: 'pvp', pct: { attackPower: 40, defense: 20, absorb: 20, evade: 20 }, pvp: true },
];

export function Optimizer() {
  const { inventory, applySlots, activeBuild, fusionLevel } = useStore();
  const { t } = useI18n();
  const [pct, setPct] = useState<Record<string, number>>({});
  const [useBudget, setUseBudget] = useState(true);
  const [allSouls, setAllSouls] = useState(false);
  const [includePvp, setIncludePvp] = useState(false);
  const [useBaseline, setUseBaseline] = useState(false);

  const budget = totalFusionPoints(fusionLevel);
  const ownedCount = Object.keys(inventory).length;
  const total = Object.values(pct).reduce((a, b) => a + (b || 0), 0);

  // Baseline = o que a pessoa marcou na 🌳 Árvore como JÁ aberto no jogo:
  // nodes com soul (no nível investido) + nodes vazios abertos (nível 1).
  // A IA só considera quando a opção estiver MARCADA e houver nodes abertos.
  const baseline = useMemo(() => {
    const b: Record<string, number> = {};
    for (const [id, s] of Object.entries(activeBuild.slots)) if (s.soulId) b[id] = Math.max(1, s.nodeLevel);
    // Nodes vazios abertos também carregam pontos investidos (como no jogo).
    for (const id of activeBuild.opened ?? []) if (!b[id]) b[id] = Math.max(1, activeBuild.slots[id]?.nodeLevel ?? 1);
    return b;
  }, [activeBuild]);
  const baselineCount = Object.keys(baseline).length;
  const activeBaseline = useBaseline && baselineCount > 0 ? baseline : undefined;

  const goal: Goal = useMemo(() => {
    const weights: Record<string, number> = {};
    for (const a of ATTRS) if (pct[a.key]) weights[a.key] = pct[a.key] * a.scale;
    return { id: 'custom', name: 'Personalizado', weights, includePvp, custom: true };
  }, [pct, includePvp]);

  // Quick build = budget-monotonic greedy (budget ladder + fill pass): the
  // fill puts a soul on every opened pass-through node and spends any
  // leftover points, and the ladder guarantees more budget never yields a
  // WORSE build (the raw greedy is myopic and could lose Attack Power when
  // given 3 extra points). Hard-capped at 217 points by the engine.
  const quick = useMemo(() => {
    const cfg: EngineConfig = {
      weights: goal.weights,
      inventory,
      allSouls,
      includePvp,
      budget: useBudget ? budget : MAX_FUSION_POINTS,
      timeMs: 0,
      rngSeed: 1,
      baseline: activeBaseline,
    };
    const genome = bestGreedyGenome(cfg);
    const slots = genomeToSlots(genome);
    const used = Object.entries(genome).map(([slotId, ge]) => {
      const nodeRarity = TREE_NODE_BY_ID[slotId].rarity;
      const svs = slotStatValues(slots[slotId], nodeRarity);
      const score = svs.reduce((s, sv) => s + (goal.weights[sv.stat] || 0) * sv.value, 0);
      return { soulId: ge.soulId, slotId, nodeRarity, nodeLevel: ge.nodeLevel, points: RARITY_POINT_COST[nodeRarity] * ge.nodeLevel, score };
    });
    return { slots, used, points: genomeCost(genome, activeBaseline) };
  }, [goal, inventory, allSouls, includePvp, useBudget, budget, activeBaseline]);

  const previewBuild = { ...activeBuild, slots: quick.slots };
  const totals = computeTotals(previewBuild);
  const overBudget = quick.points > budget;

  const notes = useMemo(
    () => feedback({ slots: quick.slots, used: quick.used } as ReturnType<typeof optimize>, pct, inventory, allSouls, t),
    [quick, pct, inventory, allSouls, t],
  );

  const setAttr = (key: string, v: number) => setPct((p) => ({ ...p, [key]: Math.max(0, Math.min(100, Math.round(v))) }));

  // ---- deep search (solver engine) ----
  const [deepTime, setDeepTime] = useState(8);
  const [deepRunning, setDeepRunning] = useState(false);
  const [deepProg, setDeepProg] = useState<DeepProgress | null>(null);
  const [deepRes, setDeepRes] = useState<SolverResult | null>(null);
  const deepCfg = useRef<EngineConfig | null>(null);

  const runDeep = async () => {
    if (deepRunning) return;
    const cfg: EngineConfig = {
      weights: goal.weights,
      inventory,
      allSouls,
      includePvp,
      budget: useBudget ? budget : MAX_FUSION_POINTS,
      timeMs: deepTime * 1000,
      rngSeed: (Date.now() % 100000) + 1,
      baseline: activeBaseline,
    };
    deepCfg.current = cfg;
    setDeepRunning(true);
    setDeepRes(null);
    setDeepProg({ sims: 0, best: 0, elapsedMs: 0, timeMs: cfg.timeMs });
    try {
      const res = await deepOptimize(cfg, (p) => setDeepProg(p));
      setDeepRes(res);
    } finally {
      setDeepRunning(false);
      setDeepProg(null);
    }
  };

  const renderToken = (tok: AdviceToken, i: number) => (
    <p key={i} className="ai-note">{t(tok.key, tok.vars)}</p>
  );

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 8 }}>
        <strong style={{ color: 'var(--gold-bright)', fontSize: 16 }}>{t('st.opt.title')}</strong>
        <span className="spacer" />
        <span className="muted">{t('st.opt.invcount', { n: ownedCount })}</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {t('st.opt.intro')}
      </p>

      {ownedCount === 0 && !allSouls && (
        <p className="warn">{t('st.opt.nowarn')}</p>
      )}

      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        <span className="muted">{t('st.opt.shortcuts')}</span>
        {QUICK.map((q) => (
          <button key={q.id} className="btn sm" onClick={() => { setPct(q.pct); if (q.pvp) setIncludePvp(true); }}>{t('st.opt.q.' + q.id)}</button>
        ))}
        <button className="btn sm" onClick={() => setPct({})}>{t('st.bb.clear')}</button>
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
          <input type="checkbox" checked={useBudget} onChange={(e) => setUseBudget(e.target.checked)} /> {t('st.opt.budget', { n: budget })}
        </label>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={allSouls} onChange={(e) => setAllSouls(e.target.checked)} /> {t('st.opt.allsouls')}
        </label>
        <HelpTip text={t('st.opt.allsouls.help')} />
        <label className="row" style={{ gap: 6 }} title={t('st.opt.baseline.help')}>
          <input type="checkbox" checked={useBaseline} onChange={(e) => setUseBaseline(e.target.checked)} />{' '}
          <span style={{ color: useBaseline && baselineCount > 0 ? 'var(--gold-bright)' : undefined }}>
            {t('st.opt.baseline', { n: baselineCount })}
          </span>
        </label>
        <HelpTip text={t('st.opt.baseline.help')} />
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={includePvp} onChange={(e) => setIncludePvp(e.target.checked)} /> {t('st.opt.pvp')}
        </label>
        <span className="spacer" />
        <button className="btn primary" disabled={quick.used.length === 0} onClick={() => applySlots(quick.slots)}>{t('st.opt.apply')}</button>
      </div>

      <div className="points-meta" style={{ marginTop: 10 }}>
        <span>{t('st.opt.nodesused')} <b>{quick.used.length}</b></span>
        <span className={overBudget ? 'over-txt' : ''}>{t('st.opt.points')} <b>{quick.points}</b> / {budget}</span>
      </div>

      {total > 0 && notes.length > 0 && (
        <div className="ai-feedback">
          <div className="total-sub">{t('st.opt.feedback')}</div>
          {notes.map((n, i) => <p key={i} className="ai-note">{n}</p>)}
        </div>
      )}

      <hr className="sep" />

      {/* ---- Deep search (solver engine) ---- */}
      <div className="deep">
        <div className="row" style={{ gap: 8 }}>
          <strong style={{ color: 'var(--gold-bright)' }}>{t('ai2.title')}</strong>
          <HelpTip text={t('ai2.desc')} />
          <span className="spacer" />
          <label className="row" style={{ gap: 6, fontSize: 13 }}>
            {t('ai2.time')}
            <select className="input" value={deepTime} onChange={(e) => setDeepTime(Number(e.target.value))}>
              <option value={3}>3s</option>
              <option value={8}>8s</option>
              <option value={20}>20s</option>
            </select>
          </label>
          <button className="btn primary" disabled={deepRunning || total === 0} onClick={runDeep}>
            {deepRunning ? t('ai2.running') : t('ai2.run')}
          </button>
        </div>

        {deepRunning && deepProg && (
          <div style={{ marginTop: 10 }}>
            <div className="points-bar">
              <div className="points-fill" style={{ width: `${Math.min(100, (deepProg.elapsedMs / deepProg.timeMs) * 100)}%` }} />
            </div>
            <div className="points-meta" style={{ marginTop: 4 }}>
              <span>{t('ai2.progress', { sims: deepProg.sims.toLocaleString(), best: Math.round(deepProg.best).toLocaleString() })}</span>
            </div>
          </div>
        )}

        {deepRes && deepRes.top.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="conf-badge">{t('ai2.confidence', { c: deepRes.confidence })}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                {deepRes.workers > 0
                  ? t('ai2.stats', { sims: deepRes.sims.toLocaleString(), s: (deepRes.elapsedMs / 1000).toFixed(1), w: deepRes.workers })
                  : t('ai2.statsinline', { sims: deepRes.sims.toLocaleString(), s: (deepRes.elapsedMs / 1000).toFixed(1) })}
              </span>
            </div>

            <div className="total-sub" style={{ marginTop: 10 }}>{t('ai2.top')}</div>
            {deepRes.top.filter((b) => b.score.total > 0).map((b, i) => (
              <div className="total-row" key={b.hash}>
                <span className="lbl">
                  <b style={{ color: i === 0 ? 'var(--gold-bright)' : undefined }}>#{i + 1}</b>{' '}
                  {t('ai2.score', { s: Math.round(b.score.total).toLocaleString() })}{' '}
                  <span className="muted">{t('ai2.buildrow', { n: Object.keys(b.genome).length, pts: b.score.points })}</span>
                </span>
                <span className="val">
                  <button className="btn sm primary" onClick={() => applySlots(genomeToSlots(b.genome))}>{t('st.opt.apply')}</button>
                </span>
              </div>
            ))}

            <div className="ai-feedback" style={{ marginTop: 10 }}>
              <div className="total-sub">{t('ai2.ex.title')}</div>
              {explainResult(deepRes).map(renderToken)}
              {deepCfg.current && recommend(deepRes, deepCfg.current).length > 0 && (
                <>
                  <div className="total-sub" style={{ marginTop: 8 }}>{t('ai2.rec.title')}</div>
                  {recommend(deepRes, deepCfg.current).map(renderToken)}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <hr className="sep" />

      <div className="opt-grid">
        <div>
          <div className="total-sub">{t('st.opt.plan', { n: quick.used.length, pts: quick.points })}</div>
          {quick.used.length === 0 && <p className="muted">{t('st.opt.distribute')}</p>}
          {quick.used
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((u) => {
              const s = SOULS_BY_ID[u.soulId];
              const node = TREE_NODE_BY_ID[u.slotId];
              const cat = NODE_CATEGORY[node.type];
              const nodeLabel = cat === 'wildcard' ? 'Wildcard' : CATEGORY_LABEL[cat];
              const svs = slotStatValues(quick.slots[u.slotId], u.nodeRarity);
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
          <div className="total-sub">{t('st.opt.estimated')}</div>
          {totals.length === 0 && <p className="muted">—</p>}
          {totals.map((tt) => (
            <div className="total-row" key={tt.key + (tt.isPvp ? 'p' : '')}>
              <span className="lbl">{tt.label}{tt.isPvp ? ' (PvP)' : ''}</span>
              <span className="val">+{fmt(tt.value, tt.unit)}</span>
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
  t: (k: string, v?: Record<string, string | number>) => string,
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
      const detail = allSouls ? t('st.opt.fb.none.all') : t('st.opt.fb.none.inv');
      msgs.push(t('st.opt.fb.none', { stat: LABEL[stat], req: reqShare, detail }));
      continue;
    }
    const maxLvl = Math.max(...souls.map((s) => (allSouls ? 3 : inv[s.id] || 0)));
    if (maxLvl < 3) {
      msgs.push(t('st.opt.fb.low', { stat: LABEL[stat], req: reqShare, ach: achShare, lvl: maxLvl }));
    } else {
      msgs.push(t('st.opt.fb.limited', { stat: LABEL[stat], req: reqShare, ach: achShare }));
    }
  }
  if (!msgs.length) msgs.push(t('st.opt.fb.ok'));
  return msgs;
}
