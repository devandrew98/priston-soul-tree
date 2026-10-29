// SVG charts of the pain diary. They draw only saved records: a recorded value is a filled dot; the line between two recorded
// values is dashed because it is only a straight connection, not a measurement.
import { useState } from 'react';
import { crisisEndMs, crisisStartMs, type CrisisStats } from '../../lib/dor/calc';
import { timeKey } from '../../lib/dor/time';
import { medLabel } from '../../lib/dor/timeline';
import type { Crisis, MedAdmin, Rec } from '../../lib/dor/types';

export const n1 = (v: number | null | undefined) => (v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','));

export interface Bar { label: string; value: number; tip?: string; color?: string }

export function BarChart({ data, max, height = 150, label, unit = '' }: { data: Bar[]; max?: number; height?: number; label: string; unit?: string }) {
  const W = 600, L = 30, B = 22, T = 10, H = height;
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  const bw = data.length ? (W - L) / data.length : 0;
  const step = Math.ceil(data.length / 12);
  const ticks = [0, 0.5, 1].map((f) => Math.round(top * f * 10) / 10);
  return (
    <svg className="dor-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {ticks.map((t) => {
        const y = T + (H - T - B) * (1 - t / top);
        return <g key={t}><line x1={L} x2={W} y1={y} y2={y} className="dor-grid" /><text x={L - 4} y={y + 3} textAnchor="end" className="dor-axis">{n1(t).replace(',0', '')}</text></g>;
      })}
      {data.map((d, i) => {
        const h = (H - T - B) * (d.value / top);
        const x = L + i * bw;
        return (
          <g key={i}>
            <rect x={x + bw * 0.15} y={H - B - h} width={Math.max(1, bw * 0.7)} height={h} rx={2} fill={d.color ?? 'var(--dor-blue)'}><title>{d.tip ?? `${d.label}: ${n1(d.value)}${unit}`}</title></rect>
            {i % step === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="dor-axis">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export interface Stack { label: string; parts: { value: number; color: string; name: string }[] }
export function StackChart({ data, label }: { data: Stack[]; label: string }) {
  const W = 600, L = 8, B = 22, T = 8, H = 150;
  const bw = data.length ? (W - L) / data.length : 0;
  const step = Math.ceil(data.length / 12);
  const top = Math.max(1, ...data.map((d) => d.parts.reduce((a, p) => a + p.value, 0)));
  return (
    <svg className="dor-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {data.map((d, i) => {
        let y = H - B;
        return (
          <g key={i}>
            {d.parts.map((p) => {
              const h = (H - T - B) * (p.value / top);
              y -= h;
              return h > 0 ? <rect key={p.name} x={L + i * bw + bw * 0.12} y={y} width={Math.max(1, bw * 0.76)} height={h} fill={p.color}><title>{`${d.label} — ${p.name}: ${p.value}`}</title></rect> : null;
            })}
            {i % step === 0 && <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="dor-axis">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Points with a gap where nothing was recorded (a missing value is never drawn as zero). */
export function LineChart({ points, max, label }: { points: { label: string; value: number | null }[]; max: number; label: string }) {
  const W = 600, L = 30, B = 22, T = 10, H = 150;
  const bw = points.length > 1 ? (W - L - 10) / (points.length - 1) : 0;
  const X = (i: number) => L + 5 + i * bw;
  const Y = (v: number) => T + (H - T - B) * (1 - v / max);
  const step = Math.ceil(points.length / 12);
  const segs: string[] = [];
  let cur = '';
  points.forEach((p, i) => { if (p.value === null) { if (cur) segs.push(cur); cur = ''; } else cur += `${cur ? 'L' : 'M'}${X(i)},${Y(p.value)}`; });
  if (cur) segs.push(cur);
  return (
    <svg className="dor-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, max / 2, max].map((t) => <g key={t}><line x1={L} x2={W} y1={Y(t)} y2={Y(t)} className="dor-grid" /><text x={L - 4} y={Y(t) + 3} textAnchor="end" className="dor-axis">{n1(t).replace(',0', '')}</text></g>)}
      {segs.map((d, i) => <path key={i} d={d} className="dor-line" />)}
      {points.map((p, i) => p.value !== null && <circle key={i} cx={X(i)} cy={Y(p.value)} r={3.5} className="dor-dot"><title>{`${p.label}: ${n1(p.value)}`}</title></circle>)}
      {points.map((p, i) => i % step === 0 && <text key={`l${i}`} x={X(i)} y={H - 6} textAnchor="middle" className="dor-axis">{p.label}</text>)}
    </svg>
  );
}

/** One crisis over its real hours: recorded intensities, dashed connections, medication marks, start and end. */
export function CrisisChart({ crisis, stats, admins, now, tz }: { crisis: Rec<Crisis>; stats: CrisisStats; admins: Rec<MedAdmin>[]; now: number; tz: string }) {
  const [pick, setPick] = useState<string>('');
  const W = 600, L = 28, R = 12, T = 26, B = 24, H = 230;
  const s = crisisStartMs(crisis.data), e = crisisEndMs(crisis.data, now);
  const times = [s, e, ...stats.points.map((p) => p.at), ...admins.map((a) => new Date(a.data.at).getTime())];
  const lo = Math.min(...times), hi = Math.max(...times, lo + 60000);
  const pad = (hi - lo) * 0.04;
  const X = (t: number) => L + ((t - (lo - pad)) / (hi - lo + 2 * pad)) * (W - L - R);
  const Y = (v: number) => T + (H - T - B) * (1 - v / 10);
  const path = stats.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.at)},${Y(p.value)}`).join('');
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const shown = pick;
  const info = stats.points.find((_, k) => `p${k}` === shown);
  const adm = admins.find((a) => a.id === shown);
  return (
    <div>
      <svg className="dor-chart dor-chart-tall" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução da intensidade da dor durante a crise">
        {[0, 2, 4, 6, 8, 10].map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="dor-grid" /><text x={L - 5} y={Y(v) + 3} textAnchor="end" className="dor-axis">{v}</text></g>)}
        <line x1={X(s)} x2={X(s)} y1={T - 6} y2={H - B} className="dor-mark-start" /><text x={X(s)} y={T - 10} textAnchor="start" className="dor-axis">início</text>
        <line x1={X(e)} x2={X(e)} y1={T - 6} y2={H - B} className="dor-mark-end" /><text x={X(e)} y={T - 10} textAnchor="end" className="dor-axis">{crisis.data.end ? 'fim' : 'agora'}</text>
        {admins.map((a) => {
          const x = X(new Date(a.data.at).getTime());
          return (
            <g key={a.id} onClick={() => setPick(a.id)} className="dor-click">
              <line x1={x} x2={x} y1={T} y2={H - B} className="dor-mark-med" />
              <text x={x} y={T + 10} textAnchor="middle">💊</text>
              <title>{`${medLabel(a.data)} às ${timeKey(new Date(a.data.at).getTime(), tz)}`}</title>
            </g>
          );
        })}
        {stats.points.length > 1 && <path d={path} className="dor-line dor-line-dashed" />}
        {stats.points.map((p, k) => (
          <circle key={k} cx={X(p.at)} cy={Y(p.value)} r={shown === `p${k}` ? 7 : 5} className="dor-dot dor-click" onClick={() => setPick(`p${k}`)} tabIndex={0} role="button"
            aria-label={`Dor ${p.value} às ${timeKey(p.at, tz)}`} onKeyDown={(ev) => { if (ev.key === 'Enter') setPick(`p${k}`); }}>
            <title>{`${timeKey(p.at, tz)} — dor ${p.value}/10`}</title>
          </circle>
        ))}
        {ticks.map((t, k) => <text key={k} x={X(t)} y={H - 6} textAnchor="middle" className="dor-axis">{timeKey(t, tz)}</text>)}
      </svg>
      <p className="dor-muted dor-small">
        {info ? `Às ${timeKey(info.at, tz)}: dor ${info.value}/10 (valor registrado).` : adm ? `Às ${timeKey(new Date(adm.data.at).getTime(), tz)}: ${medLabel(adm.data)}.` : 'Toque em um ponto para ver o horário e o valor.'}
        {' '}Pontos cheios são valores registrados; a linha tracejada só liga um ponto ao outro.
      </p>
    </div>
  );
}
