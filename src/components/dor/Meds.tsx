// Medication catalogue (for crises and continuous) and the chronological record of treatment changes.
import { useState } from 'react';
import type { DorStore } from '../../lib/dor/store';
import { dayKey, fmtDate } from '../../lib/dor/time';
import type { Med, MedCategory, Rec, Therapy, TherapyType } from '../../lib/dor/types';
import { Chips, Field, Sheet, useSaver } from './ui';

export const THERAPY_LABEL: Record<TherapyType, string> = { start: 'Início', dose: 'Mudança de dose', frequency: 'Mudança de frequência', suspend: 'Suspensão', restart: 'Reinício', note: 'Observação' };

/** First catalogue: only a starting point to edit. Not a prescription, and nothing is marked as taken. */
const SEED: Omit<Med, 'order' | 'active'>[] = [
  { name: 'Dipirona', dose: '1', unit: 'g', category: 'crisis' },
  { name: 'Dorflex', dose: '', unit: 'comprimido', category: 'crisis' },
  { name: 'Cetorolaco', dose: '10', unit: 'mg', category: 'crisis' },
  { name: 'Naproxeno', dose: '550', unit: 'mg', category: 'crisis' },
  { name: 'Amitriptilina', dose: '', unit: 'mg', category: 'continuous' },
  { name: 'Vortioxetina', dose: '10', unit: 'mg', category: 'continuous' },
  { name: 'Eszopiclona', dose: '1', unit: 'mg', category: 'continuous' },
];

export function Meds({ store }: { store: DorStore }) {
  const [form, setForm] = useState<{ rec?: Rec<Med>; category?: MedCategory } | null>(null);
  const [therapy, setTherapy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { meds } = store;

  const seed = async () => {
    setBusy(true); setErr('');
    for (const [i, m] of SEED.entries()) {
      const r = await store.save('med', { ...m, order: i, active: true } satisfies Med, null);
      if (!r.ok) { setErr(r.conflict ? 'Alterado em outro aparelho.' : r.error); break; }
    }
    setBusy(false);
  };
  const swap = async (list: Rec<Med>[], i: number, d: -1 | 1) => {
    const a = list[i], b = list[i + d];
    if (!a || !b) return;
    const ra = await store.save('med', { ...a.data, order: b.data.order }, null, a.id, a.version);
    if (ra.ok) await store.save('med', { ...b.data, order: a.data.order }, null, b.id, b.version);
  };
  const toggle = async (m: Rec<Med>) => { await store.save('med', { ...m.data, active: !m.data.active }, null, m.id, m.version); };

  const section = (cat: MedCategory, title: string) => {
    const list = meds.filter((m) => m.data.category === cat);
    const act = list.filter((m) => m.data.active);
    const off = list.filter((m) => !m.data.active);
    return (
      <section className="dor-card" aria-label={title}>
        <div className="dor-card-head"><h3>{title}</h3><button className="dor-btn small" onClick={() => setForm({ category: cat })}>+ Adicionar</button></div>
        {act.length === 0 && <p className="dor-muted">Nenhum medicamento ativo.</p>}
        <ul className="dor-list">
          {act.map((m, i) => (
            <li key={m.id}>
              <div><strong>{m.data.name}</strong><small>{m.data.dose ? `${m.data.dose} ${m.data.unit}` : 'dose não configurada'}{cat === 'continuous' ? [m.data.habitualTime && ` · ${m.data.habitualTime}`, m.data.frequency && ` · ${m.data.frequency}`].filter(Boolean).join('') : ''}</small></div>
              <div className="dor-row">
                <button className="dor-btn small" onClick={() => swap(act, i, -1)} disabled={i === 0} aria-label={`Subir ${m.data.name}`}>↑</button>
                <button className="dor-btn small" onClick={() => swap(act, i, 1)} disabled={i === act.length - 1} aria-label={`Descer ${m.data.name}`}>↓</button>
                <button className="dor-btn small" onClick={() => setForm({ rec: m })}>Editar</button>
                <button className="dor-btn small" onClick={() => toggle(m)}>Desativar</button>
              </div>
            </li>
          ))}
        </ul>
        {off.length > 0 && (
          <details className="dor-details"><summary>Desativados ({off.length})</summary>
            <ul className="dor-list">{off.map((m) => <li key={m.id}><div><strong>{m.data.name}</strong><small>os registros antigos continuam no histórico</small></div><button className="dor-btn small" onClick={() => toggle(m)}>Reativar</button></li>)}</ul>
          </details>
        )}
      </section>
    );
  };

  const log = [...store.ctx.therapy].sort((a, b) => b.data.date.localeCompare(a.data.date) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="dor-stack">
      {meds.length === 0 && (
        <section className="dor-card">
          <h3>Catálogo de medicamentos</h3>
          <p className="dor-muted">Está vazio. Você pode cadastrar um catálogo inicial (Dipirona, Dorflex, Cetorolaco, Naproxeno, Amitriptilina, Vortioxetina e Eszopiclona) e depois editar tudo. É só uma lista para facilitar: nenhum medicamento fica marcado como tomado.</p>
          <button className="dor-btn primary" onClick={seed} disabled={busy}>{busy ? 'Cadastrando…' : 'Cadastrar catálogo inicial'}</button>
          {err && <div className="dor-alert err">{err}</div>}
        </section>
      )}
      {section('crisis', 'Para crises')}
      {section('continuous', 'Uso contínuo')}
      <section className="dor-card" aria-label="Histórico terapêutico">
        <div className="dor-card-head"><h3>Evolução do tratamento</h3><button className="dor-btn small" onClick={() => setTherapy(true)}>+ Registrar alteração</button></div>
        {log.length === 0 ? <p className="dor-muted">Nenhuma alteração registrada. Mudanças de dose, frequência, suspensão e reinício aparecem aqui.</p> : (
          <ol className="dor-tl">
            {log.map((t) => (
              <li key={t.id}><div className="dor-tl-row">
                <span className="dor-tl-time">{fmtDate(t.data.date)}</span>
                <span className="dor-tl-text"><strong>{t.data.name} — {THERAPY_LABEL[t.data.type]}</strong>
                  <small>{[t.data.from || t.data.to ? `${t.data.from || '—'} → ${t.data.to || '—'}` : '', t.data.note, `registrado em ${fmtDate(dayKey(new Date(t.createdAt).getTime(), store.settings.tz))}`].filter(Boolean).join(' · ')}</small></span>
              </div></li>
            ))}
          </ol>
        )}
      </section>
      {form && <MedForm store={store} rec={form.rec} category={form.category} onClose={() => setForm(null)} />}
      {therapy && <TherapyForm store={store} onClose={() => setTherapy(false)} />}
    </div>
  );
}

function MedForm({ store, rec, category, onClose }: { store: DorStore; rec?: Rec<Med>; category?: MedCategory; onClose: () => void }) {
  const today = dayKey(Date.now(), store.settings.tz);
  const cat = rec?.data.category ?? category ?? 'crisis';
  const [name, setName] = useState(rec?.data.name ?? '');
  const [dose, setDose] = useState(rec?.data.dose ?? '');
  const [unit, setUnit] = useState(rec?.data.unit ?? 'mg');
  const [kind, setKind] = useState<MedCategory>(cat);
  const [time, setTime] = useState(rec?.data.habitualTime ?? '');
  const [freq, setFreq] = useState(rec?.data.frequency ?? '');
  const [startDate, setStartDate] = useState(rec?.data.startDate ?? (rec ? '' : today));
  const [endDate, setEndDate] = useState(rec?.data.endDate ?? '');
  const [eff, setEff] = useState(today);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const saver = useSaver(store, () => {});

  const cont = kind === 'continuous';
  const changes: { type: TherapyType; from?: string; to?: string }[] = [];
  if (rec && cont) {
    if (rec.data.dose !== dose.trim() || rec.data.unit !== unit.trim()) changes.push({ type: 'dose', from: `${rec.data.dose} ${rec.data.unit}`.trim(), to: `${dose.trim()} ${unit.trim()}`.trim() });
    if ((rec.data.frequency ?? '') !== freq.trim()) changes.push({ type: 'frequency', from: rec.data.frequency ?? '', to: freq.trim() });
    if (!rec.data.endDate && endDate) changes.push({ type: 'suspend', to: endDate });
    if (rec.data.endDate && !endDate) changes.push({ type: 'restart' });
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!name.trim()) { setErr('Informe o nome do medicamento.'); return; }
    const data: Med = {
      ...(rec?.data ?? { order: store.meds.length, active: true }),
      name: name.trim(), dose: dose.trim(), unit: unit.trim(), category: kind,
      habitualTime: cont && time ? time : undefined, frequency: cont && freq.trim() ? freq.trim() : undefined,
      startDate: cont && startDate ? startDate : undefined, endDate: cont && endDate ? endDate : undefined,
    };
    const saved = await saver.submit('med', data, null, rec);
    if (!saved) return;
    const base = { medId: saved.id, name: data.name };
    if (!rec && cont) await store.save('therapy', { ...base, date: startDate || today, type: 'start', to: `${data.dose} ${data.unit}`.trim() } satisfies Therapy, null);
    for (const c of changes) await store.save('therapy', { ...base, date: c.type === 'suspend' ? endDate : eff, type: c.type, from: c.from, to: c.to, note: note.trim() || undefined } satisfies Therapy, null);
    onClose();
  };

  return (
    <Sheet title={rec ? `Editar ${rec.data.name}` : 'Novo medicamento'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
        <div className="dor-row">
          <Field label="Dose"><input value={dose} onChange={(e) => setDose(e.target.value)} maxLength={20} inputMode="decimal" /></Field>
          <Field label="Unidade"><input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} /></Field>
        </div>
        <Chips label="Tipo" options={['Para crise', 'Uso contínuo']} value={[kind === 'crisis' ? 'Para crise' : 'Uso contínuo']} onChange={(v) => setKind(v[v.length - 1] === 'Uso contínuo' ? 'continuous' : 'crisis')} />
        {cont && (
          <>
            <div className="dor-row">
              <Field label="Horário habitual"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
              <Field label="Frequência prevista"><input value={freq} onChange={(e) => setFreq(e.target.value)} maxLength={60} placeholder="ex.: 1× ao dia" /></Field>
            </div>
            <div className="dor-row">
              <Field label="Data de início"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="Suspensão (se houver)"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
            </div>
          </>
        )}
        {changes.length > 0 && (
          <div className="dor-alert info">
            Estas alterações entram no histórico do tratamento: {changes.map((c) => THERAPY_LABEL[c.type].toLowerCase()).join(', ')}.
            <Field label="Data efetiva da mudança"><input type="date" value={eff} onChange={(e) => setEff(e.target.value)} /></Field>
            <Field label="Observação (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
          </div>
        )}
        {err && <div className="dor-alert err" role="alert">{err}</div>}
        {saver.node}
        <div className="dor-actions"><button type="button" className="dor-btn" onClick={onClose}>Cancelar</button><button type="submit" className="dor-btn primary" disabled={saver.busy}>{saver.busy ? 'Salvando…' : 'Salvar'}</button></div>
      </form>
    </Sheet>
  );
}

function TherapyForm({ store, onClose }: { store: DorStore; onClose: () => void }) {
  const [medId, setMedId] = useState(store.meds[0]?.id ?? '');
  const [type, setType] = useState<TherapyType>('note');
  const [date, setDate] = useState(dayKey(Date.now(), store.settings.tz));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const saver = useSaver(store, () => onClose());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const med = store.meds.find((m) => m.id === medId);
    if (!med) { setErr('Escolha o medicamento.'); return; }
    await saver.submit('therapy', { medId, name: med.data.name, date, type, from: from.trim() || undefined, to: to.trim() || undefined, note: note.trim() || undefined } satisfies Therapy, null);
  };
  return (
    <Sheet title="Registrar alteração do tratamento" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Medicamento"><select value={medId} onChange={(e) => setMedId(e.target.value)}>{store.meds.map((m) => <option key={m.id} value={m.id}>{m.data.name}</option>)}</select></Field>
        <Field label="Tipo"><select value={type} onChange={(e) => setType(e.target.value as TherapyType)}>{(Object.keys(THERAPY_LABEL) as TherapyType[]).map((k) => <option key={k} value={k}>{THERAPY_LABEL[k]}</option>)}</select></Field>
        <Field label="Data efetiva"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="dor-row"><Field label="De (opcional)"><input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={60} /></Field><Field label="Para (opcional)"><input value={to} onChange={(e) => setTo(e.target.value)} maxLength={60} /></Field></div>
        <Field label="Observação"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} /></Field>
        {err && <div className="dor-alert err" role="alert">{err}</div>}
        {saver.node}
        <div className="dor-actions"><button type="button" className="dor-btn" onClick={onClose}>Cancelar</button><button type="submit" className="dor-btn primary" disabled={saver.busy}>Salvar</button></div>
      </form>
    </Sheet>
  );
}
