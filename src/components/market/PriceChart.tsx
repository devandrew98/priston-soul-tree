import { useMemo, useState } from 'react';
import { fmtPrice } from '../../lib/market/helpers';
import type { Currency, PricePoint } from '../../lib/market/types';
import { useI18n } from '../../lib/i18n';

const RANGES: { key: string; days: number }[] = [
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
  { key: '90d', days: 90 },
  { key: '6m', days: 182 },
  { key: '1y', days: 365 },
  { key: 'all', days: 100000 },
];

const W = 720;
const H = 220;
const PAD = { l: 8, r: 8, t: 14, b: 18 };

export function PriceChart({ series, currency }: { series: PricePoint[]; currency: Currency }) {
  const { t } = useI18n();
  const [range, setRange] = useState('90d');

  const view = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? 90;
    const sliced = series.slice(Math.max(0, series.length - days - 1));
    const prices = sliced.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const pts = sliced.map((p, i) => {
      const x = PAD.l + (i / (sliced.length - 1 || 1)) * innerW;
      const y = PAD.t + innerH - ((p.price - min) / span) * innerH;
      return { x, y, p };
    });
    const line = pts.map((pt, i) => `${i ? 'L' : 'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1]?.x.toFixed(1)},${PAD.t + innerH} L${pts[0]?.x.toFixed(1)},${PAD.t + innerH} Z`;
    return { pts, line, area, min, max, first: prices[0], last: prices[prices.length - 1] };
  }, [series, range]);

  const up = view.last >= view.first;

  return (
    <div className="mk-chart">
      <div className="mk-chart-ranges">
        {RANGES.map((r) => (
          <button key={r.key} className={range === r.key ? 'on' : ''} onClick={() => setRange(r.key)}>
            {t(`mk.range.${r.key}`)}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mk-chart-svg" preserveAspectRatio="none" role="img" aria-label={t('mk.hist.title')}>
        <defs>
          <linearGradient id="mkArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? 'rgba(92,184,92,0.35)' : 'rgba(217,83,79,0.35)'} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + (H - PAD.t - PAD.b) * g} y2={PAD.t + (H - PAD.t - PAD.b) * g} className="mk-gridline" />
        ))}
        <path d={view.area} fill="url(#mkArea)" />
        <path d={view.line} className={`mk-line ${up ? 'up' : 'down'}`} fill="none" />
        {view.pts.length > 0 && (
          <circle cx={view.pts[view.pts.length - 1].x} cy={view.pts[view.pts.length - 1].y} r={3.5} className={`mk-dotnow ${up ? 'up' : 'down'}`} />
        )}
      </svg>
      <div className="mk-chart-axis">
        <span>{t('mk.min')}: <b>{fmtPrice(view.min, currency)}</b></span>
        <span>{t('mk.max')}: <b>{fmtPrice(view.max, currency)}</b></span>
      </div>
    </div>
  );
}
