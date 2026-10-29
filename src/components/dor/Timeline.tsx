// Timeline of a day and the summary card of a crisis (numbers + chart).
import { useState } from 'react';
import { adminsOf, crisisStats, intensitiesOf, type Ctx } from '../../lib/dor/calc';
import type { DorStore } from '../../lib/dor/store';
import { fmtDateTime, fmtDuration, timeKey } from '../../lib/dor/time';
import { dayEvents, type TLFilter } from '../../lib/dor/timeline';
import type { Crisis, Rec } from '../../lib/dor/types';
import { CrisisChart, n1 } from './charts';

export type OpenRec = (rec: Rec) => void;

export function Timeline({ store, day, onOpen }: { store: DorStore; day: string; onOpen: OpenRec }) {
  const [filter, setFilter] = useState<TLFilter>('all');
  const events = dayEvents(store.ctx, store.symptoms, day, filter);
  return (
    <section className="dor-card" aria-label="Linha do tempo">
      <div className="dor-card-head">
        <h3>Linha do tempo</h3>
        <div className="dor-seg" role="group" aria-label="Filtro da linha do tempo">
          {([['all', 'Tudo'], ['headache', 'Cefaleia'], ['meds', 'Medicamentos']] as const).map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {events.length === 0 ? <p className="dor-muted">Nenhum registro neste dia{filter !== 'all' ? ' para este filtro' : ''}.</p> : (
        <ol className="dor-tl">
          {events.map((e) => (
            <li key={e.key}>
              <button onClick={() => onOpen(e.rec)} aria-label={`${e.title}, abrir para ver ou editar`}>
                <span className="dor-tl-time">{e.rec.kind === 'sleep' || e.rec.kind === 'nopain' ? 'dia' : timeKey(e.at, store.settings.tz)}</span>
                <span className="dor-tl-icon" aria-hidden>{e.icon}</span>
                <span className="dor-tl-text"><strong>{e.title}</strong>{e.detail && <small>{e.detail}</small>}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CrisisCard({ store, crisis, onOpen, children }: { store: DorStore; crisis: Rec<Crisis>; onOpen: OpenRec; children?: React.ReactNode }) {
  const [chart, setChart] = useState(false);
  const { ctx } = store;
  const st = crisisStats(crisis, ctx.intensities, ctx.admins, ctx.now);
  const tz = ctx.tz;
  const meds = adminsOf(crisis, ctx.admins, ctx.now);
  return (
    <section className="dor-card" aria-label="Crise">
      <div className="dor-card-head">
        <h3>{fmtDateTime(new Date(crisis.data.start).getTime(), tz)}{crisis.data.end ? ` → ${fmtDateTime(new Date(crisis.data.end).getTime(), tz)}` : ' (em andamento)'}</h3>
        <button className="dor-btn small" onClick={() => onOpen(crisis)}>Editar</button>
      </div>
      <dl className="dor-kv">
        <div><dt>Duração</dt><dd>{fmtDuration(st.durationMs)}</dd></div>
        <div><dt>Inicial</dt><dd>{st.initial ?? '—'}</dd></div>
        <div><dt>Última</dt><dd>{st.last ?? '—'}</dd></div>
        <div><dt>Máxima</dt><dd>{st.max ?? '—'}</dd></div>
        <div><dt>Média simples</dt><dd>{n1(st.simpleMean)}</dd></div>
        <div><dt>Média por tempo (estimada)</dt><dd>{st.timeMean !== null ? `≈ ${n1(st.timeMean)}` : <span className="dor-muted" title="Poucas avaliações ou avaliações que não cobrem a maior parte da crise">não calculada</span>}</dd></div>
        <div><dt>Avaliações</dt><dd>{st.points.length}</dd></div>
        <div><dt>Medicamentos</dt><dd>{st.admins}</dd></div>
      </dl>
      {st.timeMean === null && st.points.length > 0 && <p className="dor-muted dor-small">{st.timeMeanReason === 'few_points' ? 'A média por tempo precisa de pelo menos duas avaliações.' : 'As avaliações registradas cobrem pouco da duração da crise, então a média por tempo não foi estimada.'}</p>}
      {(crisis.data.symptoms.length > 0 || crisis.data.location.length > 0 || crisis.data.character.length > 0 || crisis.data.factors.length > 0) && (
        <p className="dor-small">
          {[['Local', crisis.data.location], ['Tipo', crisis.data.character], ['Sintomas', crisis.data.symptoms], ['Fatores', crisis.data.factors]].filter(([, v]) => (v as string[]).length).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join(' · ')}
        </p>
      )}
      {crisis.data.note && <p className="dor-small">“{crisis.data.note}”</p>}
      {crisis.data.reopened?.length ? <p className="dor-muted dor-small">Reaberta {crisis.data.reopened.length}× (término anterior: {crisis.data.reopened.map((r) => fmtDateTime(new Date(r.prevEnd).getTime(), tz)).join('; ')}).</p> : null}
      {st.points.length > 0 || meds.length > 0 ? (
        <>
          <button className="dor-link" onClick={() => setChart(!chart)} aria-expanded={chart}>{chart ? 'Ocultar gráfico' : 'Ver gráfico da crise'}</button>
          {chart && <CrisisChart crisis={crisis} stats={st} admins={meds} now={ctx.now} tz={tz} />}
        </>
      ) : <p className="dor-muted dor-small">Sem avaliações de intensidade registradas.</p>}
      {children}
    </section>
  );
}

/** Used by reports: how many evaluations a crisis has. */
export const evaluationCount = (ctx: Ctx, c: Rec<Crisis>) => intensitiesOf(c, ctx.intensities).length;
