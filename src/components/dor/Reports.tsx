// Reports: indicators and charts for a period, comparison between periods and around treatment changes,
// and the exports (PDF through the browser's print, spreadsheets, backup). Everything is computed from the saved records.
import { useEffect, useState } from 'react';
import { adminsOf, alertsFor, compareAround, crisisStats, dayPeaks, dayStates, periodStats, type PeriodStats } from '../../lib/dor/calc';
import type { DorStore } from '../../lib/dor/store';
import { addDays, dayKey, dayRange, fmtDate, fmtDateTime, fmtDuration } from '../../lib/dor/time';
import { allEvents, crisesCsv, eventsCsv, physioDetail, physioLabel } from '../../lib/dor/timeline';
import { THERAPY_LABEL } from './Meds';
import { BarChart, CrisisChart, LineChart, StackChart, n1, type Bar, type Stack } from './charts';

type Preset = '7' | '30' | '90' | 'month' | 'custom';
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Weekly buckets of 7 days from `from`; monthly when the period is long. */
function buckets(from: string, to: string): { label: string; days: string[] }[] {
  const days = dayRange(from, to);
  if (days.length > 120) {
    const by = new Map<string, string[]>();
    for (const d of days) by.set(d.slice(0, 7), [...(by.get(d.slice(0, 7)) ?? []), d]);
    return [...by.entries()].map(([k, ds]) => ({ label: `${MONTHS[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}`, days: ds }));
  }
  const out: { label: string; days: string[] }[] = [];
  for (let i = 0; i < days.length; i += 7) out.push({ label: fmtDate(days[i]).slice(0, 5), days: days.slice(i, i + 7) });
  return out;
}

const cmpRows = (a: PeriodStats, b: PeriodStats): [string, string, string][] => [
  ['Dias com cefaleia', String(a.headacheDays), String(b.headacheDays)],
  ['Número de crises', String(a.crises), String(b.crises)],
  ['Intensidade média', n1(a.meanIntensity), n1(b.meanIntensity)],
  ['Intensidade máxima', a.maxIntensity === null ? '—' : String(a.maxIntensity), b.maxIntensity === null ? '—' : String(b.maxIntensity)],
  ['Duração média das crises', a.avgDurationMs === null ? '—' : fmtDuration(a.avgDurationMs), b.avgDurationMs === null ? '—' : fmtDuration(b.avgDurationMs)],
  ['Dias com medicamento de crise', String(a.reliefDays), String(b.reliefDays)],
  ['Administrações', String(a.administrations), String(b.administrations)],
];

function CompareTable({ a, b, la, lb }: { a: PeriodStats; b: PeriodStats; la: string; lb: string }) {
  return (
    <div className="dor-scroll">
      <table className="dor-table">
        <thead><tr><th /><th>{la}<small>{fmtDate(a.from)} a {fmtDate(a.to)}</small></th><th>{lb}<small>{fmtDate(b.from)} a {fmtDate(b.to)}</small></th></tr></thead>
        <tbody>
          {cmpRows(a, b).map(([k, x, y]) => <tr key={k}><th scope="row">{k}</th><td>{x}</td><td>{y}</td></tr>)}
          <tr><th scope="row">Dias com informação</th><td>{a.informedDays} de {a.days}</td><td>{b.informedDays} de {b.days}</td></tr>
          <tr><th scope="row">Dias não informados</th><td>{a.unknownDays}</td><td>{b.unknownDays}</td></tr>
        </tbody>
      </table>
      <p className="dor-muted dor-small">Comparação descritiva entre períodos de mesma duração. Ela não indica que uma mudança de tratamento causou melhora ou piora.</p>
    </div>
  );
}

export function Reports({ store }: { store: DorStore }) {
  const { ctx } = store;
  const today = dayKey(ctx.now, ctx.tz);
  const [preset, setPreset] = useState<Preset>('30');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [cFrom, setCFrom] = useState(addDays(today, -29));
  const [cTo, setCTo] = useState(today);
  const [mode, setMode] = useState<'summary' | 'full' | null>(null);
  const [therapyId, setTherapyId] = useState('');
  const [win, setWin] = useState(30);
  const [err, setErr] = useState('');

  let from = addDays(today, -29), to = today;
  if (preset === '7' || preset === '30' || preset === '90') from = addDays(today, -(Number(preset) - 1));
  else if (preset === 'month') { from = `${month}-01`; to = addDays(`${addDays(`${month}-01`, 31).slice(0, 7)}-01`, -1); if (to > today) to = today; }
  else { from = cFrom; to = cTo; }
  const invalid = !from || !to || from > to;
  const safeFrom = invalid ? today : from, safeTo = invalid ? today : to;
  const stats = periodStats(ctx, safeFrom, safeTo);
  const nDays = stats.days;
  const prev = periodStats(ctx, addDays(safeFrom, -nDays), addDays(safeFrom, -1));
  const alerts = alertsFor(ctx, store.alertRules, today);

  const printIt = (m: 'summary' | 'full') => {
    setMode(m);
    setTimeout(() => { window.print(); }, 150);
  };
  const backup = async () => {
    setErr('');
    try { download(`diario-de-dor-backup-${today}.json`, JSON.stringify(await store.api.exportAll(), null, 2), 'application/json'); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const days = dayRange(safeFrom, safeTo);
  const states = dayStates(ctx, days);
  const peaks = dayPeaks(ctx);
  const shownDays = days.slice(-120);
  const peakBars: Bar[] = shownDays.map((d) => ({ label: fmtDate(d).slice(0, 5), value: states.get(d) === 'headache' ? peaks.get(d) ?? 0 : 0, tip: `${fmtDate(d)}: ${states.get(d) === 'headache' ? (peaks.has(d) ? `pico ${peaks.get(d)}` : 'com cefaleia, sem intensidade registrada') : states.get(d) === 'nopain' ? 'sem cefaleia' : 'não informado'}`, color: (peaks.get(d) ?? 0) >= 7 ? 'var(--dor-red)' : (peaks.get(d) ?? 0) >= 4 ? 'var(--dor-amber)' : 'var(--dor-blue)' }));
  const bk = buckets(safeFrom, safeTo);
  const stack: Stack[] = bk.map((b) => {
    const c = { headache: 0, nopain: 0, unknown: 0 };
    for (const d of b.days) c[states.get(d)!]++;
    return { label: b.label, parts: [{ name: 'Com cefaleia', value: c.headache, color: 'var(--dor-red)' }, { name: 'Sem cefaleia', value: c.nopain, color: 'var(--dor-green)' }, { name: 'Não informado', value: c.unknown, color: 'var(--dor-gray)' }] };
  });
  const crisisBars: Bar[] = bk.map((b) => ({ label: b.label, value: periodStats(ctx, b.days[0], b.days[b.days.length - 1]).crises, tip: `${b.label}: crises` }));
  const durBars: Bar[] = ctx.crises.filter((c) => dayKey(new Date(c.data.start).getTime(), ctx.tz) >= safeFrom && dayKey(new Date(c.data.start).getTime(), ctx.tz) <= safeTo)
    .map((c) => ({ label: fmtDate(dayKey(new Date(c.data.start).getTime(), ctx.tz)).slice(0, 5), value: Math.round(crisisStats(c, ctx.intensities, ctx.admins, ctx.now).durationMs / 360000) / 10, tip: `${fmtDateTime(new Date(c.data.start).getTime(), ctx.tz)}: ${fmtDuration(crisisStats(c, ctx.intensities, ctx.admins, ctx.now).durationMs)}` }));
  const medBars: Bar[] = stats.perMed.map((m) => ({ label: m.name.slice(0, 8), value: m.administrations, tip: `${m.name}: ${m.administrations} administrações em ${m.days} dia(s)` }));
  const medDayBars: Bar[] = stats.perMed.map((m) => ({ label: m.name.slice(0, 8), value: m.days, tip: `${m.name}: ${m.days} dia(s) de uso`, color: 'var(--dor-teal)' }));
  const sleepPts = bk.length ? days.slice(-60).map((d) => ({ label: fmtDate(d).slice(0, 5), value: ctx.sleeps.find((s) => s.data.date === d && typeof s.data.hours === 'number')?.data.hours ?? null })) : [];

  const therapies = [...ctx.therapy].sort((a, b) => b.data.date.localeCompare(a.data.date));
  const chosen = therapies.find((t) => t.id === therapyId);
  const around = chosen ? compareAround(ctx, chosen.data.date, win) : null;

  return (
    <div className="dor-stack">
      <section className="dor-card" aria-label="Período">
        <h2>Relatórios</h2>
        <div className="dor-seg wrap" role="group" aria-label="Período">
          {([['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['month', 'Mês'], ['custom', 'Personalizado']] as const).map(([k, l]) => <button key={k} className={preset === k ? 'on' : ''} aria-pressed={preset === k} onClick={() => setPreset(k)}>{l}</button>)}
        </div>
        {preset === 'month' && <Field2 label="Mês"><input type="month" value={month} max={today.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Field2>}
        {preset === 'custom' && <div className="dor-row wrap"><Field2 label="De"><input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} /></Field2><Field2 label="Até"><input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} /></Field2></div>}
        {invalid ? <div className="dor-alert err">A data inicial precisa ser anterior à final.</div> : <p className="dor-muted">{fmtDate(safeFrom)} a {fmtDate(safeTo)} · {nDays} dias · {stats.informedDays} com informação, {stats.unknownDays} não informados</p>}
      </section>

      {alerts.map((a) => <div key={a.rule.id} className="dor-alert info" role="status">Foi identificada uma frequência elevada de utilização de medicamentos para cefaleia no período selecionado. Considere revisar esses registros com sua médica.</div>)}

      <Indicators s={stats} />

      <section className="dor-card"><h3>Intensidade máxima por dia</h3><BarChart data={peakBars} max={10} label="Intensidade máxima por dia" />{days.length > 120 && <p className="dor-muted dor-small">Mostrando os últimos 120 dias do período.</p>}<p className="dor-muted dor-small">Dias sem barra: sem cefaleia, não informados ou sem intensidade registrada.</p></section>
      <section className="dor-card"><h3>Dias com cefaleia, sem cefaleia e não informados</h3><StackChart data={stack} label="Estado dos dias" /><ul className="dor-legend"><li><i className="lg headache" /> com cefaleia</li><li><i className="lg nopain" /> sem cefaleia</li><li><i className="lg unknown" /> não informado</li></ul></section>
      <section className="dor-card"><h3>Crises por {days.length > 120 ? 'mês' : 'semana'}</h3><BarChart data={crisisBars} label="Número de crises" /></section>
      <section className="dor-card"><h3>Duração das crises (horas)</h3>{durBars.length ? <BarChart data={durBars} label="Duração das crises" unit=" h" /> : <p className="dor-muted">Sem crises no período.</p>}</section>
      <section className="dor-card"><h3>Medicamentos para crise</h3>{medBars.length ? <><p className="dor-small">Administrações</p><BarChart data={medBars} label="Administrações por medicamento" /><p className="dor-small">Dias de uso</p><BarChart data={medDayBars} label="Dias de uso por medicamento" /></> : <p className="dor-muted">Nenhum medicamento de crise registrado no período.</p>}</section>
      <section className="dor-card"><h3>Sono (horas, últimos 60 dias do período)</h3>{sleepPts.some((p) => p.value !== null) ? <LineChart points={sleepPts} max={12} label="Horas de sono" /> : <p className="dor-muted">Nenhuma hora de sono registrada.</p>}
        <p className="dor-small">Média: {stats.sleepMean === null ? '—' : `${n1(stats.sleepMean)} h`} · qualidade: boa {stats.sleepQuality.boa}, regular {stats.sleepQuality.regular}, ruim {stats.sleepQuality.ruim}</p>
        <SleepVsHeadache store={store} from={safeFrom} to={safeTo} />
      </section>

      <PhysioCard store={store} from={safeFrom} to={safeTo} />

      <section className="dor-card"><h3>Comparação com o período anterior</h3><CompareTable a={stats} b={prev} la="Período selecionado" lb="Período anterior (mesma duração)" /></section>

      <section className="dor-card">
        <h3>Antes e depois de uma alteração do tratamento</h3>
        {therapies.length === 0 ? <p className="dor-muted">Registre alterações em Medicamentos para compará-las aqui.</p> : (
          <>
            <div className="dor-row wrap">
              <Field2 label="Alteração"><select value={therapyId} onChange={(e) => setTherapyId(e.target.value)}><option value="">Escolher…</option>{therapies.map((t) => <option key={t.id} value={t.id}>{fmtDate(t.data.date)} — {t.data.name}: {THERAPY_LABEL[t.data.type]}</option>)}</select></Field2>
              <Field2 label="Janela"><select value={win} onChange={(e) => setWin(Number(e.target.value))}>{[14, 30, 60, 90].map((w) => <option key={w} value={w}>{w} dias antes e depois</option>)}</select></Field2>
            </div>
            {around && <CompareTable a={around.before} b={around.after} la="Antes" lb="Depois" />}
          </>
        )}
      </section>

      <section className="dor-card" aria-label="Exportar">
        <h3>Exportar</h3>
        <div className="dor-quick">
          <button className="dor-btn primary" onClick={() => printIt('summary')} disabled={invalid}>PDF resumido</button>
          <button className="dor-btn primary" onClick={() => printIt('full')} disabled={invalid}>PDF completo</button>
          <button className="dor-btn" onClick={() => download(`diario-de-dor-eventos-${today}.csv`, eventsCsv(ctx, store.symptoms), 'text/csv;charset=utf-8')}>Planilha: registros (CSV)</button>
          <button className="dor-btn" onClick={() => download(`diario-de-dor-crises-${today}.csv`, crisesCsv(ctx), 'text/csv;charset=utf-8')}>Planilha: crises (CSV)</button>
          <button className="dor-btn" onClick={backup}>Backup completo (JSON)</button>
        </div>
        <p className="dor-muted dor-small">O PDF abre a janela de impressão do navegador: escolha “Salvar como PDF”. Em A4.</p>
        {err && <div className="dor-alert err">{err}</div>}
      </section>

      {mode && <ReportDoc store={store} from={safeFrom} to={safeTo} mode={mode} stats={stats} prev={prev} onDone={() => setMode(null)} />}
    </div>
  );
}

/** Physiotherapy sessions of the period, newest first. */
const physioIn = (store: DorStore, from: string, to: string) =>
  store.ctx.physio.filter((p) => { const d = dayKey(new Date(p.data.at).getTime(), store.ctx.tz); return d >= from && d <= to; }).sort((a, b) => b.data.at.localeCompare(a.data.at));

function PhysioCard({ store, from, to }: { store: DorStore; from: string; to: string }) {
  const list = physioIn(store, from, to);
  return (
    <section className="dor-card" aria-label="Fisioterapia">
      <h3>Fisioterapia no período</h3>
      <p className="dor-small">Fisioterapeuta responsável: {store.settings.physio}</p>
      {list.length === 0 ? <p className="dor-muted">Nenhuma sessão registrada no período.</p> : (
        <>
          <p className="dor-small">{list.length} sessão(ões).</p>
          <ul className="dor-list">{list.map((p) => <li key={p.id}><div><strong>{fmtDateTime(new Date(p.data.at).getTime(), store.ctx.tz)}</strong><small>{[physioLabel(p.data), physioDetail(p.data)].filter(Boolean).join(' — ')}</small></div></li>)}</ul>
        </>
      )}
    </section>
  );
}

function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="dor-field"><span>{label}</span>{children}</label>;
}

function Indicators({ s }: { s: PeriodStats }) {
  const items: [string, string][] = [
    ['Dias com cefaleia', String(s.headacheDays)], ['Dias sem cefaleia (confirmados)', String(s.nopainDays)], ['Dias não informados', String(s.unknownDays)],
    ['Número de crises', String(s.crises)], ['Frequência (crises a cada 30 dias)', n1(s.frequencyPer30)], ['Duração média das crises', s.avgDurationMs === null ? '—' : fmtDuration(s.avgDurationMs)],
    ['Intensidade média', n1(s.meanIntensity)], ['Intensidade máxima', s.maxIntensity === null ? '—' : String(s.maxIntensity)],
    ['Dias com medicamento de crise', String(s.reliefDays)], ['Administrações', String(s.administrations)], ['Medicamentos diferentes', String(s.distinctMeds)],
  ];
  return (
    <section className="dor-card" aria-label="Indicadores">
      <h3>Indicadores do período</h3>
      <dl className="dor-kv big">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {s.perMed.length > 0 && (
        <div className="dor-scroll"><table className="dor-table"><thead><tr><th>Medicamento</th><th>Administrações</th><th>Dias de uso</th><th>Quantidade total</th></tr></thead>
          <tbody>{s.perMed.map((m) => <tr key={m.name}><th scope="row">{m.name}</th><td>{m.administrations}</td><td>{m.days}</td><td>{String(m.quantity).replace('.', ',')}</td></tr>)}</tbody></table></div>
      )}
      <p className="dor-muted dor-small">“Número de crises” e “dias com cefaleia” são coisas diferentes: duas crises no mesmo dia contam como 2 crises e 1 dia. Crises sobrepostas não somam o tempo duas vezes. A média de intensidade usa só as avaliações registradas.</p>
    </section>
  );
}

/** Headache frequency by sleep category: shown as counts, never as cause. */
function SleepVsHeadache({ store, from, to }: { store: DorStore; from: string; to: string }) {
  const { ctx } = store;
  const days = dayRange(from, to);
  const states = dayStates(ctx, days);
  const rows = (['boa', 'regular', 'ruim'] as const).map((q) => {
    const ds = ctx.sleeps.filter((s) => s.data.quality === q && s.data.date >= from && s.data.date <= to).map((s) => s.data.date);
    // sleep of the night of day D is compared with headache on the next day (the day it may have affected)
    const withNext = ds.map((d) => states.get(addDays(d, 1))).filter(Boolean);
    return { q, n: ds.length, head: withNext.filter((x) => x === 'headache').length, known: withNext.filter((x) => x !== 'unknown').length };
  });
  if (rows.every((r) => r.n === 0)) return null;
  return (
    <div className="dor-scroll"><table className="dor-table"><thead><tr><th>Qualidade do sono</th><th>Registros</th><th>Cefaleia no dia seguinte</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.q}><th scope="row">{r.q}</th><td>{r.n}</td><td>{r.head} de {r.known} dias informados</td></tr>)}</tbody></table>
      <p className="dor-muted dor-small">Contagem descritiva: não mostra que o sono causou ou evitou a cefaleia.</p></div>
  );
}

// ---------- the printable document ----------
function ReportDoc({ store, from, to, mode, stats, prev, onDone }: { store: DorStore; from: string; to: string; mode: 'summary' | 'full'; stats: PeriodStats; prev: PeriodStats; onDone: () => void }) {
  const { ctx, settings } = store;
  useEffect(() => { window.addEventListener('afterprint', onDone, { once: true }); return () => window.removeEventListener('afterprint', onDone); }, [onDone]);
  const days = dayRange(from, to);
  const states = dayStates(ctx, days);
  const peaks = dayPeaks(ctx);
  const peakBars: Bar[] = days.slice(-120).map((d) => ({ label: fmtDate(d).slice(0, 5), value: states.get(d) === 'headache' ? peaks.get(d) ?? 0 : 0 }));
  const bk = buckets(from, to);
  const stack: Stack[] = bk.map((b) => {
    const c = { headache: 0, nopain: 0, unknown: 0 };
    for (const d of b.days) c[states.get(d)!]++;
    return { label: b.label, parts: [{ name: 'Com cefaleia', value: c.headache, color: '#d64545' }, { name: 'Sem cefaleia', value: c.nopain, color: '#3d9a6a' }, { name: 'Não informado', value: c.unknown, color: '#b8c2cc' }] };
  });
  const crises = ctx.crises.filter((c) => { const d = dayKey(new Date(c.data.start).getTime(), ctx.tz); return d >= from && d <= to; });
  const adm = ctx.admins.filter((a) => { const d = dayKey(new Date(a.data.at).getTime(), ctx.tz); return d >= from && d <= to; });
  const physio = physioIn(store, from, to);
  const tl = allEvents(ctx, store.symptoms).filter((e) => { const d = dayKey(e.at, ctx.tz); return d >= from && d <= to; });
  return (
    <article className="dor-print" aria-hidden>
      <header>
        <h1>Diário de Dor – Adolpho</h1>
        <p>Relatório {mode === 'full' ? 'completo' : 'resumido'} · Período: {fmtDate(from)} a {fmtDate(to)}<br />Médica responsável pelo acompanhamento: {settings.doctor}<br />Fisioterapeuta responsável: {settings.physio}<br />Gerado em {fmtDateTime(Date.now(), ctx.tz)}</p>
      </header>
      <h2>Indicadores principais</h2>
      <table><tbody>
        <tr><th>Dias com cefaleia</th><td>{stats.headacheDays}</td><th>Dias sem cefaleia (confirmados)</th><td>{stats.nopainDays}</td></tr>
        <tr><th>Dias não informados</th><td>{stats.unknownDays}</td><th>Número de crises</th><td>{stats.crises}</td></tr>
        <tr><th>Frequência (a cada 30 dias)</th><td>{n1(stats.frequencyPer30)}</td><th>Duração média das crises</th><td>{stats.avgDurationMs === null ? '—' : fmtDuration(stats.avgDurationMs)}</td></tr>
        <tr><th>Intensidade média</th><td>{n1(stats.meanIntensity)}</td><th>Intensidade máxima</th><td>{stats.maxIntensity ?? '—'}</td></tr>
        <tr><th>Dias com medicamento de crise</th><td>{stats.reliefDays}</td><th>Administrações</th><td>{stats.administrations}</td></tr>
      </tbody></table>
      <p className="note">Dias com informação: {stats.informedDays} de {stats.days}. Dias não informados não foram considerados dias sem dor.</p>
      <h2>Medicamentos para crise</h2>
      {stats.perMed.length ? <table><thead><tr><th>Medicamento</th><th>Administrações</th><th>Dias de uso</th><th>Quantidade</th></tr></thead><tbody>{stats.perMed.map((m) => <tr key={m.name}><td>{m.name}</td><td>{m.administrations}</td><td>{m.days}</td><td>{String(m.quantity).replace('.', ',')}</td></tr>)}</tbody></table> : <p>Nenhum registrado.</p>}
      <h2>Fisioterapia (liberação miofascial e manipulação)</h2>
      <p>Fisioterapeuta responsável: {settings.physio}</p>
      {physio.length ? <table><thead><tr><th>Data/hora</th><th>Técnicas</th><th>Dor antes</th><th>Dor depois</th><th>Obs.</th></tr></thead><tbody>{physio.map((p) => <tr key={p.id}><td>{fmtDateTime(new Date(p.data.at).getTime(), ctx.tz)}</td><td>{physioLabel(p.data)}</td><td>{p.data.painBefore ?? '—'}</td><td>{p.data.painAfter ?? '—'}</td><td>{p.data.note ?? ''}</td></tr>)}</tbody></table> : <p>Nenhuma sessão registrada no período.</p>}
      <h2>Gráficos</h2>
      <h3>Intensidade máxima por dia</h3><BarChart data={peakBars} max={10} label="Intensidade máxima por dia" height={140} />
      <h3>Estado dos dias</h3><StackChart data={stack} label="Estado dos dias" />
      <h2>Comparação com o período anterior</h2>
      <table><thead><tr><th /><th>Selecionado</th><th>Anterior ({fmtDate(prev.from)} a {fmtDate(prev.to)})</th></tr></thead><tbody>{cmpRows(stats, prev).map(([k, x, y]) => <tr key={k}><th>{k}</th><td>{x}</td><td>{y}</td></tr>)}</tbody></table>
      <p className="note">Comparação descritiva, sem relação de causa e efeito. Médias estimadas pelo tempo são aproximações feitas só com as avaliações registradas.</p>
      {mode === 'full' && (
        <>
          <h2 className="break">Crises detalhadas</h2>
          {crises.length === 0 && <p>Nenhuma crise no período.</p>}
          {crises.map((c) => {
            const st = crisisStats(c, ctx.intensities, ctx.admins, ctx.now);
            const meds = adminsOf(c, ctx.admins, ctx.now);
            return (
              <section key={c.id} className="crisis">
                <h3>{fmtDateTime(new Date(c.data.start).getTime(), ctx.tz)} → {c.data.end ? fmtDateTime(new Date(c.data.end).getTime(), ctx.tz) : 'em andamento'} ({fmtDuration(st.durationMs)})</h3>
                <p>Inicial {st.initial ?? '—'} · Última {st.last ?? '—'} · Máxima {st.max ?? '—'} · Média simples {n1(st.simpleMean)} · Média por tempo {st.timeMean === null ? 'não calculada' : `≈ ${n1(st.timeMean)} (estimada)`}</p>
                <p>{[['Local', c.data.location], ['Característica', c.data.character], ['Sintomas', c.data.symptoms], ['Fatores', c.data.factors]].filter(([, v]) => (v as string[]).length).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join(' · ')}{c.data.note ? ` · Obs.: ${c.data.note}` : ''}</p>
                {(st.points.length > 0 || meds.length > 0) && <CrisisChart crisis={c} stats={st} admins={meds} now={ctx.now} tz={ctx.tz} />}
                <table><thead><tr><th>Horário</th><th>Registro</th></tr></thead><tbody>
                  {allEvents(ctx, store.symptoms).filter((e) => ('crisisId' in e.rec.data && (e.rec.data as { crisisId?: string }).crisisId === c.id) || e.rec.id === c.id).map((e) => <tr key={e.key}><td>{fmtDateTime(e.at, ctx.tz)}</td><td>{e.title}{e.detail ? ` — ${e.detail}` : ''}</td></tr>)}
                </tbody></table>
              </section>
            );
          })}
          <h2 className="break">Medicamentos administrados</h2>
          <table><thead><tr><th>Data/hora</th><th>Medicamento</th><th>Qtd.</th><th>Situação</th><th>Obs.</th></tr></thead><tbody>
            {adm.map((a) => <tr key={a.id}><td>{fmtDateTime(new Date(a.data.at).getTime(), ctx.tz)}</td><td>{a.data.name} {a.data.dose} {a.data.unit} ({a.data.category === 'crisis' ? 'crise' : 'contínuo'})</td><td>{a.data.quantity}</td><td>{a.data.status === 'taken' ? 'administrado' : 'omitido'}</td><td>{a.data.note ?? ''}</td></tr>)}
          </tbody></table>
          <h2>Histórico de alterações terapêuticas</h2>
          {ctx.therapy.length ? <table><thead><tr><th>Data efetiva</th><th>Medicamento</th><th>Alteração</th><th>Detalhe</th></tr></thead><tbody>{[...ctx.therapy].sort((a, b) => a.data.date.localeCompare(b.data.date)).map((t) => <tr key={t.id}><td>{fmtDate(t.data.date)}</td><td>{t.data.name}</td><td>{THERAPY_LABEL[t.data.type]}</td><td>{[t.data.from || t.data.to ? `${t.data.from ?? '—'} → ${t.data.to ?? '—'}` : '', t.data.note].filter(Boolean).join(' · ')}</td></tr>)}</tbody></table> : <p>Nenhuma registrada.</p>}
          <h2>Sono</h2>
          <table><thead><tr><th>Data</th><th>Horas</th><th>Qualidade</th><th>Obs.</th></tr></thead><tbody>
            {ctx.sleeps.filter((s) => s.data.date >= from && s.data.date <= to).map((s) => <tr key={s.id}><td>{fmtDate(s.data.date)}</td><td>{s.data.hours ?? '—'}</td><td>{s.data.quality ?? '—'}</td><td>{s.data.note ?? ''}</td></tr>)}
          </tbody></table>
          <h2 className="break">Linha do tempo cronológica</h2>
          <table><thead><tr><th>Data/hora</th><th>Registro</th></tr></thead><tbody>
            {tl.map((e) => <tr key={e.key}><td>{e.rec.kind === 'sleep' || e.rec.kind === 'nopain' ? fmtDate(dayKey(e.at, 'UTC')) : fmtDateTime(e.at, ctx.tz)}</td><td>{e.title}{e.detail ? ` — ${e.detail}` : ''}</td></tr>)}
          </tbody></table>
        </>
      )}
      <footer>Médica responsável pelo acompanhamento: {settings.doctor}. Fisioterapeuta responsável: {settings.physio}. Este relatório apresenta apenas os registros feitos no diário e não substitui avaliação médica.</footer>
    </article>
  );
}
