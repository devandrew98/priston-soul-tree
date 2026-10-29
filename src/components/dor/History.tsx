// History: month calendar (headache / confirmed no headache / not informed, with the highest intensity of the day) and the full day.
import { useMemo, useState } from 'react';
import { crisisDays, crisisEndMs, crisisStartMs, dayPeaks, dayStates, unionMs } from '../../lib/dor/calc';
import type { DorStore } from '../../lib/dor/store';
import { addDays, dayKey, dayRange, dayStartMs, fmtDate, fmtDuration, localToMs } from '../../lib/dor/time';
import type { Rec } from '../../lib/dor/types';
import { n1 } from './charts';
import { todayOf } from './Home';
import type { Open } from './sheets';
import { CrisisCard, Timeline } from './Timeline';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const peakClass = (p: number | undefined) => (p === undefined ? '' : p >= 7 ? ' p-high' : p >= 4 ? ' p-mid' : ' p-low');

export function History({ store, open, onOpenRec }: { store: DorStore; open: Open; onOpenRec: (r: Rec) => void }) {
  const { ctx } = store;
  const today = todayOf(store);
  const [sel, setSel] = useState(today);
  const [ym, setYm] = useState(() => today.slice(0, 7));
  const [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`;
  const lead = new Date(`${first}T12:00:00Z`).getUTCDay();
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = dayRange(first, `${ym}-${String(dim).padStart(2, '0')}`);
  const states = dayStates(ctx, days);
  const peaks = useMemo(() => dayPeaks(ctx), [ctx]);
  const shift = (d: number) => { const dt = new Date(Date.UTC(y, m - 1 + d, 1)); setYm(dt.toISOString().slice(0, 7)); };

  // filters
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fMin, setFMin] = useState('');
  const [fMed, setFMed] = useState('');
  const filtering = Boolean(fFrom || fTo || fMin || fMed);
  const found = useMemo(() => {
    if (!filtering) return [];
    const from = fFrom || addDays(today, -90), to = fTo || today;
    const list = dayRange(from, to);
    const st = dayStates(ctx, list);
    return list.filter((d) => {
      if (st.get(d) !== 'headache') return false;
      if (fMin && (peaks.get(d) ?? -1) < Number(fMin)) return false;
      if (fMed && !ctx.admins.some((a) => a.data.medId === fMed && a.data.status === 'taken' && dayKey(new Date(a.data.at).getTime(), ctx.tz) === d)) return false;
      return true;
    }).reverse();
  }, [filtering, fFrom, fTo, fMin, fMed, ctx, peaks, today]);

  return (
    <div className="dor-stack">
      <section className="dor-card" aria-label="Calendário">
        <div className="dor-card-head">
          <button className="dor-btn small" onClick={() => shift(-1)} aria-label="Mês anterior">‹</button>
          <h2>{MONTHS[m - 1]} de {y}</h2>
          <button className="dor-btn small" onClick={() => shift(1)} aria-label="Próximo mês">›</button>
        </div>
        <div className="dor-cal" role="grid" aria-label={`Calendário de ${MONTHS[m - 1]}`}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="dor-cal-h" aria-hidden>{d}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
          {days.map((d) => {
            const st = states.get(d)!;
            const pk = st === 'headache' ? peaks.get(d) : undefined;
            return (
              <button key={d} role="gridcell" className={`dor-day ${st}${peakClass(pk)}${d === sel ? ' sel' : ''}${d === today ? ' today' : ''}`} onClick={() => setSel(d)}
                aria-label={`${fmtDate(d)}: ${st === 'headache' ? `com cefaleia${pk !== undefined ? `, pico ${pk}` : ''}` : st === 'nopain' ? 'sem cefaleia' : 'não informado'}`} aria-pressed={d === sel}>
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        <ul className="dor-legend" aria-label="Legenda">
          <li><i className="lg headache p-low" /> cefaleia, pico 0–3</li><li><i className="lg headache p-mid" /> pico 4–6</li><li><i className="lg headache p-high" /> pico 7–10</li>
          <li><i className="lg nopain" /> sem cefaleia (confirmado)</li><li><i className="lg unknown" /> não informado</li>
        </ul>
      </section>

      <details className="dor-card dor-details" open={filtering}>
        <summary>Filtros (período, intensidade, medicamento)</summary>
        <div className="dor-row wrap">
          <label className="dor-field"><span>De</span><input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} /></label>
          <label className="dor-field"><span>Até</span><input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} /></label>
          <label className="dor-field"><span>Pico mínimo</span><select value={fMin} onChange={(e) => setFMin(e.target.value)}><option value="">Qualquer</option>{Array.from({ length: 10 }, (_, i) => i + 1).map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="dor-field"><span>Medicamento usado</span><select value={fMed} onChange={(e) => setFMed(e.target.value)}><option value="">Qualquer</option>{store.meds.map((md) => <option key={md.id} value={md.id}>{md.data.name}</option>)}</select></label>
        </div>
        {filtering && (
          <>
            <p className="dor-muted">{found.length} dia(s) com cefaleia encontrados {fFrom || fTo ? '' : '(últimos 90 dias)'}.</p>
            <div className="dor-chips">{found.map((d) => <button key={d} className="dor-chip" onClick={() => { setSel(d); setYm(d.slice(0, 7)); }}>{fmtDate(d)}{peaks.has(d) ? ` · ${peaks.get(d)}` : ''}</button>)}</div>
            <button className="dor-link" onClick={() => { setFFrom(''); setFTo(''); setFMin(''); setFMed(''); }}>Limpar filtros</button>
          </>
        )}
      </details>

      <DayView store={store} day={sel} open={open} onOpenRec={onOpenRec} />
    </div>
  );
}

function DayView({ store, day, open, onOpenRec }: { store: DorStore; day: string; open: Open; onOpenRec: (r: Rec) => void }) {
  const { ctx } = store;
  const state = dayStates(ctx, [day]).get(day)!;
  const sMs = dayStartMs(day, ctx.tz), eMs = dayStartMs(addDays(day, 1), ctx.tz);
  const crises = ctx.crises.filter((c) => crisisDays(c.data, ctx.tz, ctx.now).includes(day));
  const ints = ctx.intensities.filter((i) => dayKey(new Date(i.data.at).getTime(), ctx.tz) === day);
  const admins = ctx.admins.filter((a) => a.data.status === 'taken' && dayKey(new Date(a.data.at).getTime(), ctx.tz) === day);
  const sleep = ctx.sleeps.find((s) => s.data.date === day);
  const nopain = ctx.nopain.find((n) => n.data.date === day);
  const withPain = unionMs(crises.map((c) => ({ s: Math.max(crisisStartMs(c.data), sMs), e: Math.min(crisisEndMs(c.data, ctx.now), eMs) })));
  const [msg, setMsg] = useState('');
  const mark = async () => {
    setMsg('');
    const r = await store.save('nopain', { date: day }, `${day}T12:00:00Z`);
    if (!r.ok) setMsg(r.conflict ? 'Alterado em outro aparelho.' : `Não foi possível salvar: ${r.error}`);
  };
  const noon = new Date(localToMs(day, '12:00', ctx.tz)).toISOString();
  return (
    <>
      <section className="dor-card" aria-label={`Resumo de ${fmtDate(day)}`}>
        <div className="dor-card-head"><h2>{fmtDate(day)}</h2><span className={`dor-badge ${state}`}>{state === 'headache' ? 'Com cefaleia' : state === 'nopain' ? 'Sem cefaleia' : 'Não informado'}</span></div>
        <dl className="dor-kv">
          <div><dt>Crises</dt><dd>{crises.length}</dd></div>
          <div><dt>Pico</dt><dd>{ints.length ? Math.max(...ints.map((i) => i.data.value)) : '—'}</dd></div>
          <div><dt>Média simples</dt><dd>{ints.length ? n1(ints.reduce((a, i) => a + i.data.value, 0) / ints.length) : '—'}</dd></div>
          <div><dt>Tempo com dor</dt><dd>{crises.length ? fmtDuration(withPain) : '—'}</dd></div>
          <div><dt>Administrações</dt><dd>{admins.length}</dd></div>
          <div><dt>Sono</dt><dd>{sleep ? [typeof sleep.data.hours === 'number' ? `${String(sleep.data.hours).replace('.', ',')} h` : '', sleep.data.quality].filter(Boolean).join(' · ') || 'registrado' : '—'}</dd></div>
        </dl>
        <div className="dor-quick">
          <button className="dor-btn" onClick={() => open({ t: 'crisis', startAt: noon })}>+ Crise neste dia</button>
          <button className="dor-btn" onClick={() => open({ t: 'med', pick: { at: noon } })}>+ Medicamento</button>
          <button className="dor-btn" onClick={() => open({ t: 'sleep', date: day })}>{sleep ? 'Editar sono' : '+ Sono'}</button>
          {state === 'unknown' && <button className="dor-btn" onClick={mark}>Marcar “sem cefaleia”</button>}
          {nopain && <button className="dor-btn" onClick={() => onOpenRec(nopain)}>Sem cefaleia confirmado: ver/desfazer</button>}
        </div>
        {nopain && state === 'headache' && <p className="dor-muted dor-small">Este dia tinha a confirmação “sem cefaleia”, mas depois foi registrada uma crise; vale a crise. A confirmação continua no histórico.</p>}
        {msg && <div className="dor-alert err" role="alert">{msg}</div>}
      </section>
      {crises.map((c) => <CrisisCard key={c.id} store={store} crisis={c} onOpen={onOpenRec} />)}
      <Timeline store={store} day={day} onOpen={onOpenRec} />
    </>
  );
}
