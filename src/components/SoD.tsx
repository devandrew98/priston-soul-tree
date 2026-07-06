import { useMemo, useState } from 'react';
import { SOD_ROUNDS, SOD_TOTAL_SEC, fmtMS, perMin } from '../lib/sod';
import { useI18n } from '../lib/i18n';

type Points = (number | null)[];

const EMPTY: Points = SOD_ROUNDS.map(() => null);

function loadPoints(): Points {
  try {
    const raw = JSON.parse(localStorage.getItem('sod-points') || 'null');
    if (Array.isArray(raw) && raw.length === SOD_ROUNDS.length) {
      return raw.map((v) => (typeof v === 'number' && isFinite(v) ? v : null));
    }
  } catch {
    /* ignore */
  }
  return [...EMPTY];
}

export function SoD() {
  const { t } = useI18n();
  const [points, setPoints] = useState<Points>(loadPoints);
  const [record, setRecord] = useState<number | null>(() => {
    const v = Number(localStorage.getItem('sod-record'));
    return isFinite(v) && v > 0 ? v : null;
  });

  const setRoundPoints = (i: number, raw: string) =>
    setPoints((prev) => {
      const nx = [...prev];
      if (raw === '') {
        nx[i] = null;
      } else {
        const n = Number(raw);
        nx[i] = isFinite(n) ? Math.max(0, Math.floor(n)) : prev[i];
      }
      localStorage.setItem('sod-points', JSON.stringify(nx));
      return nx;
    });

  const stats = useMemo(() => {
    const filled = points.filter((p): p is number => p != null);
    const total = filled.reduce((a, b) => a + b, 0);
    const anyFilled = filled.length > 0;
    const overallPace = total > 0 ? (total / SOD_TOTAL_SEC) * 60 : 0;

    const rows = SOD_ROUNDS.map((r, i) => {
      const p = points[i];
      const pm = p != null ? perMin(p, r.durationSec) : 0;
      return { round: r, points: p, perMin: pm };
    });

    const withPts = rows.filter((row) => row.points != null && row.points > 0);
    const best = withPts.length ? withPts.reduce((a, b) => (b.perMin > a.perMin ? b : a)) : null;
    const worst = withPts.length > 1 ? withPts.reduce((a, b) => (b.perMin < a.perMin ? b : a)) : null;
    const maxPoints = Math.max(1, ...rows.map((row) => row.points ?? 0));
    // Average pace over the rounds actually played — the fair yardstick for
    // flagging a round strong/weak, regardless of how many rounds are filled.
    const avgPace = withPts.length ? withPts.reduce((a, b) => a + b.perMin, 0) / withPts.length : 0;

    return { rows, total, anyFilled, overallPace, avgPace, best, worst, maxPoints };
  }, [points]);

  const clear = () => {
    if (!window.confirm(t('sod.clearconfirm'))) return;
    setPoints([...EMPTY]);
    localStorage.setItem('sod-points', JSON.stringify(EMPTY));
  };

  const saveRecord = () => {
    setRecord(stats.total);
    localStorage.setItem('sod-record', String(stats.total));
  };

  const isNewRecord = stats.total > 0 && (record == null || stats.total > record);
  const deltaVsRecord = record != null ? stats.total - record : null;

  return (
    <div className="tb sod">
      <header className="tb-head">
        <h1 className="tb-h1">{t('sod.title')}</h1>
        <p className="tb-sub">{t('sod.subtitle')}</p>
      </header>

      {/* rounds table */}
      <div className="sod-table" role="table">
        <div className="sod-row sod-head" role="row">
          <span>{t('sod.round')}</span>
          <span>{t('sod.endsat')}</span>
          <span>{t('sod.duration')}</span>
          <span>{t('sod.points')}</span>
          <span>{t('sod.permin')}</span>
          <span className="sod-barcol" />
        </div>
        {stats.rows.map((row, i) => {
          const hasPts = row.points != null && row.points > 0;
          // Only flag strong/weak once there are at least two rounds to compare.
          const rank = stats.avgPace > 0 && hasPts && stats.rows.filter((r) => (r.points ?? 0) > 0).length > 1;
          const strong = rank && row.perMin >= stats.avgPace;
          const weak = rank && row.perMin < stats.avgPace;
          return (
            <div className={`sod-row ${strong ? 'strong' : ''} ${weak ? 'weak' : ''}`} role="row" key={row.round.n}>
              <span className="sod-rn">R{row.round.n}</span>
              <span className="sod-dim">{row.round.endLabel}</span>
              <span className="sod-dim">{fmtMS(row.round.durationSec)}</span>
              <span>
                <input
                  className="sod-input"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={row.points ?? ''}
                  onChange={(e) => setRoundPoints(i, e.target.value)}
                />
              </span>
              <span className="sod-pm">{row.perMin ? row.perMin.toFixed(1) : '—'}</span>
              <span className="sod-barcol">
                <span className="sod-bar-track">
                  <span
                    className="sod-bar-fill"
                    style={{ width: `${((row.points ?? 0) / stats.maxPoints) * 100}%` }}
                    title={strong ? t('sod.strong') : weak ? t('sod.weak') : ''}
                  />
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* metrics */}
      {stats.anyFilled ? (
        <div className="sod-metrics">
          <div className="sod-metric big">
            <span className="sod-metric-lbl">{t('sod.total')}</span>
            <span className="sod-metric-val">{stats.total}</span>
          </div>
          <div className="sod-metric">
            <span className="sod-metric-lbl">{t('sod.overallpace')}</span>
            <span className="sod-metric-val">{stats.overallPace.toFixed(1)} <small>{t('sod.permin')}</small></span>
          </div>
          <div className="sod-metric">
            <span className="sod-metric-lbl">{t('sod.totaltime')}</span>
            <span className="sod-metric-val">{fmtMS(SOD_TOTAL_SEC)}</span>
          </div>
          {stats.best && (
            <div className="sod-metric">
              <span className="sod-metric-lbl">{t('sod.best')}</span>
              <span className="sod-metric-val strong">R{stats.best.round.n} · {stats.best.perMin.toFixed(1)}</span>
            </div>
          )}
          {stats.worst && (
            <div className="sod-metric">
              <span className="sod-metric-lbl">{t('sod.worst')}</span>
              <span className="sod-metric-val weak">R{stats.worst.round.n} · {stats.worst.perMin.toFixed(1)}</span>
            </div>
          )}
          <div className="sod-metric">
            <span className="sod-metric-lbl">{t('sod.record')}</span>
            <span className="sod-metric-val">
              {record != null ? record : t('sod.record.none')}
              {isNewRecord && <em className="sod-new"> · {t('sod.record.new')}</em>}
              {!isNewRecord && deltaVsRecord != null && deltaVsRecord !== 0 && (
                <em className="sod-delta"> · {t('sod.record.vs', { delta: deltaVsRecord > 0 ? `+${deltaVsRecord}` : String(deltaVsRecord) })}</em>
              )}
            </span>
          </div>
        </div>
      ) : (
        <p className="tb-hint">{t('sod.enterpoints')}</p>
      )}

      {/* actions */}
      <div className="sod-actions">
        <button className="btn sm" onClick={saveRecord} disabled={!isNewRecord} title={t('sod.saverecord')}>
          {t('sod.saverecord')}
        </button>
        <button className="btn sm" onClick={clear}>
          {t('sod.clear')}
        </button>
      </div>
    </div>
  );
}
