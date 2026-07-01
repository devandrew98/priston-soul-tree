import { computeTotals, countFilled, pointsSpent } from '../lib/calc';
import { fmt } from '../lib/formula';
import { TREE_NODES } from '../lib/tree';
import { useStore, totalFusionPoints } from '../store';

export function TotalsPanel() {
  const { activeBuild, fusionLevel, setFusionLevel } = useStore();
  const totals = computeTotals(activeBuild);
  const pve = totals.filter((t) => !t.isPvp);
  const pvp = totals.filter((t) => t.isPvp);
  const filled = countFilled(activeBuild);

  const totalPoints = totalFusionPoints(fusionLevel);
  const spent = pointsSpent(activeBuild);
  const remaining = totalPoints - spent;
  const over = remaining < 0;
  const pct = Math.min(100, totalPoints > 0 ? (spent / totalPoints) * 100 : 0);

  return (
    <div className="panel totals">
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

      <hr className="sep" />

      <h3>Atributos da Build</h3>
      <div className="fill-meter">{filled} / {TREE_NODES.length} nodes preenchidos</div>

      {pve.length === 0 && pvp.length === 0 && <p className="muted">Adicione souls para ver os atributos.</p>}

      {pve.length > 0 && <div className="total-sub">PvE</div>}
      {pve.map((t) => (
        <div className="total-row" key={t.key}>
          <span className="lbl">{t.label}</span>
          <span className="val">+{fmt(t.value, t.unit)}</span>
        </div>
      ))}

      {pvp.length > 0 && <div className="total-sub">PvP</div>}
      {pvp.map((t) => (
        <div className="total-row" key={'pvp' + t.key}>
          <span className="lbl">{t.label}</span>
          <span className="val">+{fmt(t.value, t.unit)}</span>
        </div>
      ))}
    </div>
  );
}
