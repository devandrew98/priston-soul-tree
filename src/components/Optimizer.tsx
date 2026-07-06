import { useMemo, useState } from 'react';
import { optimize, type Goal } from '../lib/optimizer';
import { RARITY_LABEL, fmt } from '../lib/formula';
import { computeTotals, slotStatValues } from '../lib/calc';
import { TREE_NODE_BY_ID, NODE_CATEGORY } from '../lib/tree';
import { SOULS, SOULS_BY_ID, CATEGORY_LABEL } from '../lib/souls';
import { useStore, totalFusionPoints } from '../store';
import { useI18n } from '../lib/i18n';
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
const QUICK: { id: string; pct: Record<string, number>; pvp?: boolean }[] = [
  { id: 'atk', pct: { attackPower: 70, critRate: 30 } },
  { id: 'tank', pct: { defense: 30, absorb: 40, hp: 30 } },
  { id: 'farm', pct: { exp: 60, hp: 20, absorb: 20 } },
  { id: 'pvp', pct: { attackPower: 40, defense: 20, absorb: 20, evade: 20 }, pvp: true },
];

export function Optimizer() {
  const { inventory, applySlots, activeBuild, fusionLevel } = useStore();
  const { t } = useI18n();
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
    () => feedback(result, pct, inventory, allSouls, t),
    [result, pct, inventory, allSouls, t],
  );

  const setAttr = (key: string, v: number) => setPct((p) => ({ ...p, [key]: Math.max(0, Math.min(100, Math.round(v))) }));

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
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={includePvp} onChange={(e) => setIncludePvp(e.target.checked)} /> {t('st.opt.pvp')}
        </label>
        <span className="spacer" />
        <button className="btn primary" disabled={result.used.length === 0} onClick={() => applySlots(result.slots)}>{t('st.opt.apply')}</button>
      </div>

      <div className="points-meta" style={{ marginTop: 10 }}>
        <span>{t('st.opt.nodesused')} <b>{result.used.length}</b></span>
        <span className={overBudget ? 'over-txt' : ''}>{t('st.opt.points')} <b>{result.pointsSpent}</b> / {budget}</span>
      </div>

      {total > 0 && notes.length > 0 && (
        <div className="ai-feedback">
          <div className="total-sub">{t('st.opt.feedback')}</div>
          {notes.map((n, i) => <p key={i} className="ai-note">{n}</p>)}
        </div>
      )}

      <hr className="sep" />

      <div className="opt-grid">
        <div>
          <div className="total-sub">{t('st.opt.plan', { n: result.used.length, pts: result.pointsSpent })}</div>
          {result.used.length === 0 && <p className="muted">{t('st.opt.distribute')}</p>}
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
