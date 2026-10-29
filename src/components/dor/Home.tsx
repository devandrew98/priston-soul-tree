// Home of the pain diary: today at a glance, the crisis in progress, continuous medication and quick actions.
import { useState } from 'react';
import { alertsFor, crisisDays, dayStates } from '../../lib/dor/calc';
import type { DorStore } from '../../lib/dor/store';
import { dayKey, fmtDuration, localToMs, timeKey } from '../../lib/dor/time';
import type { Med, Rec } from '../../lib/dor/types';
import { n1 } from './charts';
import type { Open } from './sheets';
import { Timeline } from './Timeline';

const RECENT_MS = 24 * 3600000;

/** "Iniciar crise": if one ended recently, the person decides between reopening it and starting a new one. */
export function startCrisisFlow(store: DorStore, open: Open) {
  const last = [...store.ctx.crises].filter((c) => c.data.end).sort((a, b) => b.data.end!.localeCompare(a.data.end!))[0];
  if (last && store.ctx.now - new Date(last.data.end!).getTime() < RECENT_MS) open({ t: 'choice' }); else open({ t: 'crisis' });
}
export function intensityFlow(store: DorStore, open: Open) {
  const cur = store.ctx.crises.filter((c) => !c.data.end).pop();
  if (cur) open({ t: 'intensity', crisisId: cur.id }); else open({ t: 'crisis' });
}
export const todayOf = (store: DorStore) => dayKey(store.ctx.now, store.settings.tz);

const weekday = (key: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
const STATE_LABEL = { headache: 'Com cefaleia', nopain: 'Sem cefaleia', unknown: 'Não informado' } as const;

export function Home({ store, open, onOpenRec, goHistory }: { store: DorStore; open: Open; onOpenRec: (r: Rec) => void; goHistory: () => void }) {
  const { ctx } = store;
  const today = todayOf(store);
  const state = dayStates(ctx, [today]).get(today)!;
  const todayCrises = ctx.crises.filter((c) => crisisDays(c.data, ctx.tz, ctx.now).includes(today));
  const openCrises = ctx.crises.filter((c) => !c.data.end);
  const ints = ctx.intensities.filter((i) => dayKey(new Date(i.data.at).getTime(), ctx.tz) === today).sort((a, b) => a.data.at.localeCompare(b.data.at));
  const takenToday = ctx.admins.filter((a) => a.data.status === 'taken' && dayKey(new Date(a.data.at).getTime(), ctx.tz) === today);
  const alerts = alertsFor(ctx, store.alertRules, today);
  const [msg, setMsg] = useState('');

  const noPain = async () => {
    setMsg('');
    if (state === 'headache') { setMsg('Hoje já existe uma crise registrada, então o dia conta como com cefaleia.'); return; }
    if (state === 'nopain') { setMsg('Hoje já está marcado como sem cefaleia.'); return; }
    const r = await store.save('nopain', { date: today }, `${today}T12:00:00Z`);
    if (!r.ok) setMsg(r.conflict ? 'Alterado em outro aparelho.' : `Não foi possível salvar: ${r.error}`);
  };

  const continuous = store.meds.filter((m) => m.data.category === 'continuous' && m.data.active && (!m.data.startDate || m.data.startDate <= today) && (!m.data.endDate || m.data.endDate >= today));

  const take = (m: Rec<Med>) => {
    const at = m.data.habitualTime ? new Date(localToMs(today, m.data.habitualTime, ctx.tz)).toISOString() : new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
    open({ t: 'med', pick: { med: m, at } });
  };

  return (
    <div className="dor-stack">
      {openCrises.map((c) => (
        <section key={c.id} className="dor-card dor-live" aria-label="Crise em andamento">
          <p className="dor-notice">Você possui uma crise em andamento.</p>
          <p className="dor-small">Início às {timeKey(new Date(c.data.start).getTime(), ctx.tz)} · há {fmtDuration(ctx.now - new Date(c.data.start).getTime())}</p>
          <CrisisSummary store={store} id={c.id} />
          <div className="dor-grid2">
            <button className="dor-btn primary" onClick={() => open({ t: 'intensity', crisisId: c.id })}>Atualizar dor</button>
            <button className="dor-btn" onClick={() => open({ t: 'med', pick: { crisisId: c.id } })}>Registrar medicamento</button>
            <button className="dor-btn" onClick={() => open({ t: 'symptom', rec: c })}>Atualizar sintomas</button>
            <button className="dor-btn" onClick={() => open({ t: 'edit', rec: c })}>Corrigir horário de início</button>
          </div>
          <button className="dor-btn danger-outline wide" onClick={() => open({ t: 'end', rec: c })}>Encerrar crise</button>
        </section>
      ))}

      <section className="dor-card" aria-label="Resumo de hoje">
        <div className="dor-card-head">
          <h2>Hoje</h2>
          <span className={`dor-badge ${state}`}>{STATE_LABEL[state]}</span>
        </div>
        <p className="dor-muted">{weekday(today)}</p>
        <dl className="dor-kv">
          <div><dt>Crises</dt><dd>{todayCrises.length}</dd></div>
          <div><dt>Dor máxima</dt><dd>{ints.length ? Math.max(...ints.map((i) => i.data.value)) : '—'}</dd></div>
          <div><dt>Última dor</dt><dd>{ints.length ? ints[ints.length - 1].data.value : '—'}</dd></div>
          <div><dt>Medicamentos</dt><dd>{takenToday.length}</dd></div>
        </dl>
      </section>

      {alerts.map((a) => (
        <div key={a.rule.id} className="dor-alert info" role="status">
          Foi identificada uma frequência elevada de utilização de medicamentos para cefaleia no período selecionado ({a.days} dias em {a.rule.data.windowDays}). Considere revisar esses registros com sua médica.
        </div>
      ))}

      <section className="dor-card" aria-label="Ações rápidas">
        <h3>Ações rápidas</h3>
        <div className="dor-quick">
          <button className="dor-btn primary" onClick={() => startCrisisFlow(store, open)}>🤕 Iniciar crise</button>
          <button className="dor-btn" onClick={() => open({ t: 'med' })}>💊 Registrar medicamento</button>
          <button className="dor-btn" onClick={() => intensityFlow(store, open)}>📈 Registrar intensidade</button>
          <button className="dor-btn" onClick={noPain}>🌤 Hoje não tive dor</button>
          <button className="dor-btn" onClick={() => open({ t: 'sleep' })}>😴 Registrar sono</button>
          <button className="dor-btn" onClick={() => open({ t: 'physio' })}>🙌 Fisioterapia</button>
        </div>
        {msg && <div className="dor-alert warn" role="status">{msg}</div>}
      </section>

      <section className="dor-card" aria-label="Medicamentos contínuos">
        <h3>Medicamentos contínuos</h3>
        {continuous.length === 0 ? <p className="dor-muted">Nenhum medicamento contínuo ativo. Cadastre em Medicamentos.</p> : (
          <ul className="dor-list">
            {continuous.map((m) => {
              const mine = ctx.admins.filter((a) => a.data.medId === m.id && dayKey(new Date(a.data.at).getTime(), ctx.tz) === today);
              const taken = mine.find((a) => a.data.status === 'taken');
              const omitted = !taken && mine.find((a) => a.data.status === 'omitted');
              return (
                <li key={m.id}>
                  <div>
                    <strong>{m.data.name}</strong>
                    <small>{[m.data.dose && `${m.data.dose} ${m.data.unit}`, m.data.habitualTime && `habitual ${m.data.habitualTime}`, m.data.frequency].filter(Boolean).join(' · ') || 'dose não configurada'}</small>
                    {taken && <small className="dor-ok">✓ Administrado hoje às {timeKey(new Date(taken.data.at).getTime(), ctx.tz)}</small>}
                    {omitted && <small className="dor-warn">Dose omitida (informada)</small>}
                    {!taken && !omitted && <small className="dor-muted">Hoje: não registrado</small>}
                  </div>
                  <button className={`dor-btn${taken ? '' : ' primary'}`} onClick={() => take(m)}>{taken ? 'Outra dose' : 'Tomei'}</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Timeline store={store} day={today} onOpen={onOpenRec} />
      <button className="dor-link center" onClick={goHistory}>Ver dias anteriores no Histórico</button>
    </div>
  );
}

function CrisisSummary({ store, id }: { store: DorStore; id: string }) {
  const c = store.ctx.crises.find((x) => x.id === id);
  if (!c) return null;
  const pts = store.ctx.intensities.filter((i) => i.data.crisisId === id).sort((a, b) => a.data.at.localeCompare(b.data.at));
  return (
    <dl className="dor-kv">
      <div><dt>Dor atual</dt><dd>{pts.length ? pts[pts.length - 1].data.value : '—'}</dd></div>
      <div><dt>Pico</dt><dd>{pts.length ? Math.max(...pts.map((p) => p.data.value)) : '—'}</dd></div>
      <div><dt>Avaliações</dt><dd>{pts.length}</dd></div>
      <div><dt>Média simples</dt><dd>{pts.length ? n1(pts.reduce((a, p) => a + p.data.value, 0) / pts.length) : '—'}</dd></div>
    </dl>
  );
}
