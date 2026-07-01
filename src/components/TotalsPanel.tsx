import type { Unit } from '../lib/types';
import { computeTotals, countFilled, pointsSpent } from '../lib/calc';
import { fmt } from '../lib/formula';
import { TREE_NODES } from '../lib/tree';
import { useStore, totalFusionPoints } from '../store';

// Fixed stat list shown in the game's SOULS STATS panel, with the in-game labels.
const GAME_STATS: { key: string; label: string; unit: Unit }[] = [
  { key: 'attackPower', label: 'Attack Power', unit: 'flat' },
  { key: 'attackRating', label: 'Attack Rating', unit: 'flat' },
  { key: 'critRate', label: 'Critical', unit: 'pct' },
  { key: 'block', label: 'Block', unit: 'pct' },
  { key: 'evade', label: 'Evade', unit: 'pct' },
  { key: 'moveSpeed', label: 'Run Speed', unit: 'flat' },
  { key: 'hp', label: 'Add HP', unit: 'flat' },
  { key: 'stamina', label: 'Add STM', unit: 'flat' },
  { key: 'mana', label: 'Add MP', unit: 'flat' },
  { key: 'defense', label: 'Defense', unit: 'flat' },
  { key: 'absorb', label: 'Absorb', unit: 'flat' },
  { key: 'exp', label: 'Experience', unit: 'pct' },
  { key: 'ownItemType', label: 'Own Item Type', unit: 'pct' },
  { key: 'ownSpecChance', label: 'Own Spec Chance', unit: 'pct' },
  { key: 'agingSuccess', label: 'Aging Success', unit: 'pct' },
];

export function TotalsPanel() {
  const { activeBuild, fusionLevel, setFusionLevel } = useStore();
  const totals = computeTotals(activeBuild);
  const filled = countFilled(activeBuild);

  // Split contributions into PvE (regular souls) and PvP (PvP souls).
  const pve: Record<string, number> = {};
  const pvp: Record<string, number> = {};
  for (const t of totals) (t.isPvp ? pvp : pve)[t.key] = t.value;

  const totalPoints = totalFusionPoints(fusionLevel);
  const spent = pointsSpent(activeBuild);
  const remaining = totalPoints - spent;
  const over = remaining < 0;
  const pct = Math.min(100, totalPoints > 0 ? (spent / totalPoints) * 100 : 0);

  return (
    <div className="panel totals">
      {/* SOULS STATS — reproduz o painel do jogo */}
      <div className="souls-stats">
        <div className="ss-head">
          <span className="ss-title">SOULS STATS</span>
          <span className="ss-cols">PVE / PVP</span>
        </div>
        {GAME_STATS.map((s) => {
          const pv = pve[s.key] ?? 0;
          const pp = pvp[s.key] ?? 0;
          const on = pv !== 0 || pp !== 0;
          return (
            <div className={`ss-row ${on ? 'on' : ''}`} key={s.key}>
              <span className="ss-lbl">{s.label}:</span>
              <span className="ss-val">{fmt(pv, s.unit)}</span>
              <span className="ss-sep">/</span>
              <span className="ss-val pvp">{fmt(pp, s.unit)}</span>
            </div>
          );
        })}
      </div>

      <div className="fill-meter" style={{ marginTop: 10 }}>{filled} / {TREE_NODES.length} nodes preenchidos</div>

      <hr className="sep" />

      <h3>Pontos de Fusão</h3>
      <div className="fusion-row">
        <label>Nível de Fusão (Soul Level)</label>
        <input
          className="input"
          type="number"
          min={1}
          max={400}
          value={fusionLevel}
          onChange={(e) => setFusionLevel(Number(e.target.value))}
        />
      </div>
      <div className="points-bar">
        <div className={`points-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="points-meta">
        <span>Gasto <b>{spent}</b></span>
        <span className={over ? 'over-txt' : ''}>Disponível <b>{remaining}</b></span>
        <span className="muted">Total {totalPoints}</span>
      </div>
      {over && <p className="warn" style={{ marginTop: 6 }}>⚠️ Você gastou {-remaining} pontos além do seu limite.</p>}
      <p className="muted" style={{ fontSize: 11, margin: '6px 0 0' }}>
        16 pontos (níveis 1–80) + 1 por nível de fusão.
      </p>
    </div>
  );
}
