// Forms of the pain diary. Every form works for creating and for editing (past dates included, with no limit).
import { useEffect, useState } from 'react';
import type { HistoryEntry } from '../../lib/dor/api';
import type { DorStore } from '../../lib/dor/store';
import { dayKey, fmtDateTime } from '../../lib/dor/time';
import { PHYSIO_TECHNIQUES, type Crisis, type Intensity, type Med, type MedAdmin, type NoPain, type Physio, type Rec, type Sleep } from '../../lib/dor/types';
import { Chips, DateTimeField, Field, IntensityPicker, Sheet, SheetExtra, Stepper, nowIso, useSaver } from './ui';

export const LOCATION = ['Frontal', 'Temporal', 'Occipital', 'Retro-orbitária', 'Unilateral direita', 'Unilateral esquerda', 'Bilateral', 'Cervical/nuca', 'Outra'];
export const CHARACTER = ['Pulsátil', 'Pressão/aperto', 'Pontada', 'Queimação', 'Contínua', 'Outra'];
export const SYMPTOMS = ['Náusea', 'Vômitos', 'Fotofobia', 'Fonofobia', 'Aura visual', 'Tontura', 'Dor cervical', 'Lacrimejamento', 'Outros', 'Nenhum'];
export const FACTORS = ['Estresse', 'Privação de sono', 'Jejum', 'Desidratação', 'Atividade física', 'Cafeína', 'Uso prolongado de telas', 'Outros'];

type Props = { store: DorStore; onClose: () => void };

function Actions({ busy, label = 'Salvar', onCancel }: { busy: boolean; label?: string; onCancel: () => void }) {
  return (
    <div className="dor-actions">
      <button type="button" className="dor-btn" onClick={onCancel}>Cancelar</button>
      <button type="submit" className="dor-btn primary" disabled={busy}>{busy ? 'Salvando…' : label}</button>
    </div>
  );
}

/** Details of the headache (all optional). */
function Details({ v, set }: { v: Pick<Crisis, 'location' | 'character' | 'symptoms' | 'factors'>; set: (p: Partial<Crisis>) => void }) {
  return (
    <details className="dor-details">
      <summary>Detalhes da cefaleia (opcional)</summary>
      <Chips label="Localização" options={LOCATION} value={v.location} onChange={(location) => set({ location })} />
      <Chips label="Característica" options={CHARACTER} value={v.character} onChange={(character) => set({ character })} />
      <Chips label="Sintomas associados" options={SYMPTOMS} value={v.symptoms} onChange={(symptoms) => set({ symptoms })} />
      <Chips label="Possíveis fatores associados" options={FACTORS} value={v.factors} onChange={(factors) => set({ factors })} />
    </details>
  );
}

// ---------- crisis: start, edit, reopen ----------
export function CrisisForm({ store, onClose, rec, reopen, startAt }: Props & { rec?: Rec<Crisis>; reopen?: boolean; startAt?: string }) {
  const tz = store.settings.tz;
  const [start, setStart] = useState(rec?.data.start ?? startAt ?? nowIso());
  const [end, setEnd] = useState(reopen ? '' : rec?.data.end ?? '');
  const [value, setValue] = useState<number | null>(null);
  const [note, setNote] = useState(rec?.data.note ?? '');
  const [d, setD] = useState({ location: rec?.data.location ?? [], character: rec?.data.character ?? [], symptoms: rec?.data.symptoms ?? [], factors: rec?.data.factors ?? [] });
  const [created, setCreated] = useState<Rec | null>(null);
  const [localErr, setLocalErr] = useState('');
  const saver = useSaver(store, () => {});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    if (!start) { setLocalErr('Informe a data e o horário de início.'); return; }
    if (end && new Date(end) <= new Date(start)) { setLocalErr('O término precisa ser depois do início.'); return; }
    let crisis = created;
    if (!crisis) {
      const data: Crisis = { ...(rec?.data ?? {}), start, ...d, note: note.trim() || undefined };
      if (end) data.end = end; else delete data.end;
      if (reopen && rec?.data.end) data.reopened = [...(rec.data.reopened ?? []), { at: nowIso(), prevEnd: rec.data.end }];
      crisis = await saver.submit('crisis', data, start, rec);
      if (!crisis) return;
      setCreated(crisis);
    }
    if (!rec && value !== null) {
      const ok = await saver.submit('intensity', { crisisId: crisis.id, at: start, value } satisfies Intensity, start);
      if (!ok) return;
    }
    onClose();
  };

  const title = reopen ? 'Reabrir crise' : rec ? 'Editar crise' : 'Iniciar crise';
  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {reopen && rec?.data.end && <p className="dor-muted">A crise terminava em {fmtDateTime(new Date(rec.data.end).getTime(), tz)}. Ao reabrir, ela volta a ficar em andamento; corrija o início se precisar. O histórico da reabertura fica guardado.</p>}
        <DateTimeField label="Início" iso={start} onChange={setStart} tz={tz} />
        {rec && !reopen && <DateTimeField label="Término" iso={end} onChange={setEnd} tz={tz} optional />}
        {!rec && <IntensityPicker value={value} onChange={setValue} label="Intensidade inicial (0 a 10)" />}
        <Field label="Observação (opcional)"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} /></Field>
        <Details v={d} set={(p) => setD({ ...d, ...p } as typeof d)} />
        {localErr && <div className="dor-alert err" role="alert">{localErr}</div>}
        {created && <div className="dor-alert warn">A crise foi registrada, mas a intensidade inicial ainda não. Toque em Salvar para tentar de novo.</div>}
        {saver.node}
        <Actions busy={saver.busy} label={reopen ? 'Reabrir' : rec ? 'Salvar' : 'Iniciar'} onCancel={onClose} />
      </form>
    </Sheet>
  );
}

export function EndForm({ store, onClose, crisis }: Props & { crisis: Rec<Crisis> }) {
  const tz = store.settings.tz;
  const [end, setEnd] = useState(nowIso());
  const [value, setValue] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [closed, setClosed] = useState<Rec | null>(null);
  const saver = useSaver(store, () => {});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!end || new Date(end) <= new Date(crisis.data.start)) { setErr('O término precisa ser depois do início.'); return; }
    let c = closed;
    if (!c) {
      c = await saver.submit('crisis', { ...crisis.data, end, endNote: note.trim() || undefined }, crisis.data.start, crisis);
      if (!c) return;
      setClosed(c);
    }
    if (value !== null && !(await saver.submit('intensity', { crisisId: crisis.id, at: end, value } satisfies Intensity, end))) return;
    onClose();
  };
  return (
    <Sheet title="Encerrar crise" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="dor-muted">Início: {fmtDateTime(new Date(crisis.data.start).getTime(), tz)}</p>
        <DateTimeField label="Término" iso={end} onChange={setEnd} tz={tz} />
        <IntensityPicker value={value} onChange={setValue} label="Intensidade final (opcional)" />
        <Field label="Observação (opcional)"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} /></Field>
        {err && <div className="dor-alert err" role="alert">{err}</div>}
        {closed && <div className="dor-alert warn">A crise foi encerrada, mas a intensidade final ainda não. Toque em Salvar para tentar de novo.</div>}
        {saver.node}
        <Actions busy={saver.busy} label="Encerrar crise" onCancel={onClose} />
      </form>
    </Sheet>
  );
}

// ---------- intensity ----------
export function IntensityForm({ store, onClose, crisisId, rec, afterAdminId, heading }: Props & { crisisId?: string; rec?: Rec<Intensity>; afterAdminId?: string; heading?: string }) {
  const tz = store.settings.tz;
  const [at, setAt] = useState(rec?.data.at ?? nowIso());
  const [value, setValue] = useState<number | null>(rec ? rec.data.value : null);
  const [note, setNote] = useState(rec?.data.note ?? '');
  const [err, setErr] = useState('');
  const saver = useSaver(store, () => onClose());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (value === null) { setErr('Escolha a intensidade de 0 a 10.'); return; }
    await saver.submit('intensity', { ...(rec?.data ?? {}), crisisId: rec?.data.crisisId ?? crisisId, at, value, note: note.trim() || undefined, afterAdminId: rec?.data.afterAdminId ?? afterAdminId } satisfies Intensity, at, rec);
  };
  return (
    <Sheet title={heading ?? (rec ? 'Editar intensidade' : 'Atualizar dor')} onClose={onClose}>
      <form onSubmit={submit}>
        <IntensityPicker value={value} onChange={setValue} />
        <DateTimeField label="Horário" iso={at} onChange={setAt} tz={tz} />
        <Field label="Observação (opcional)"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} /></Field>
        {err && <div className="dor-alert err" role="alert">{err}</div>}
        {saver.node}
        <Actions busy={saver.busy} onCancel={onClose} />
      </form>
    </Sheet>
  );
}

// ---------- symptoms during a crisis ----------
export function SymptomForm({ store, onClose, crisis }: Props & { crisis: Rec<Crisis> }) {
  const [at, setAt] = useState(nowIso());
  const [symptoms, setSymptoms] = useState<string[]>(crisis.data.symptoms);
  const [note, setNote] = useState('');
  const saver = useSaver(store, () => onClose());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rec = await saver.submit('symptom', { crisisId: crisis.id, at, symptoms, note: note.trim() || undefined }, at);
    if (rec) await store.save('crisis', { ...crisis.data, symptoms }, crisis.data.start, crisis.id, crisis.version);
  };
  return (
    <Sheet title="Atualizar sintomas" onClose={onClose}>
      <form onSubmit={submit}>
        <Chips label="Sintomas agora" options={SYMPTOMS} value={symptoms} onChange={setSymptoms} />
        <DateTimeField label="Horário" iso={at} onChange={setAt} tz={store.settings.tz} />
        <Field label="Observação (opcional)"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} /></Field>
        {saver.node}
        <Actions busy={saver.busy} onCancel={onClose} />
      </form>
    </Sheet>
  );
}

// ---------- medication taken ----------
export interface MedPick { med?: Rec<Med>; at?: string; crisisId?: string }
export function MedAdminForm({ store, onClose, rec, pick, onSaved }: Props & { rec?: Rec<MedAdmin>; pick?: MedPick; onSaved?: (rec: Rec<MedAdmin>) => void }) {
  const tz = store.settings.tz;
  const active = store.meds.filter((m) => m.data.active);
  const initial = rec ? rec.data : pick?.med ? { medId: pick.med.id, name: pick.med.data.name, dose: pick.med.data.dose, unit: pick.med.data.unit, category: pick.med.data.category } : null;
  const [medId, setMedId] = useState<string>(initial?.medId ?? (rec ? rec.data.medId : ''));
  const [name, setName] = useState(initial?.name ?? '');
  const [dose, setDose] = useState(initial?.dose ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? 'mg');
  const [category, setCategory] = useState<'crisis' | 'continuous'>(initial?.category ?? 'crisis');
  const [quantity, setQuantity] = useState(rec?.data.quantity ?? 1);
  const [at, setAt] = useState(rec?.data.at ?? pick?.at ?? nowIso());
  const openCrises = store.ctx.crises.filter((c) => !c.data.end);
  const [crisisId, setCrisisId] = useState(rec?.data.crisisId ?? pick?.crisisId ?? (category === 'crisis' ? openCrises[0]?.id ?? '' : ''));
  const [omitted, setOmitted] = useState(rec?.data.status === 'omitted');
  const [note, setNote] = useState(rec?.data.note ?? '');
  const [err, setErr] = useState('');
  const saver = useSaver(store, () => {});

  const choose = (id: string) => {
    setMedId(id);
    const m = store.meds.find((x) => x.id === id);
    if (m) { setName(m.data.name); setDose(m.data.dose); setUnit(m.data.unit); setCategory(m.data.category); if (m.data.category === 'continuous') setCrisisId(''); }
    else if (id === '') { setName(''); setDose(''); }
  };
  const crisisOptions = store.ctx.crises.filter((c) => !c.data.end || dayKey(new Date(c.data.start).getTime(), tz) >= dayKey(Date.now() - 3 * 86400000, tz)).slice(-8).reverse();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!name.trim()) { setErr('Informe o medicamento.'); return; }
    if (!at) { setErr('Informe a data e o horário.'); return; }
    const data: MedAdmin = { medId: medId || `manual:${name.trim().toLowerCase()}`, name: name.trim(), dose: dose.trim(), unit: unit.trim(), category, quantity, at, crisisId: crisisId || undefined, note: note.trim() || undefined, status: omitted ? 'omitted' : 'taken' };
    const saved = await saver.submit('med_admin', data, at, rec);
    if (saved) { onClose(); onSaved?.(saved as Rec<MedAdmin>); }
  };

  return (
    <Sheet title={rec ? 'Editar medicamento' : 'Registrar medicamento'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Medicamento">
          <select value={medId.startsWith('manual:') ? '' : medId} onChange={(e) => choose(e.target.value)}>
            <option value="">Outro medicamento (digitar)</option>
            {(['crisis', 'continuous'] as const).map((cat) => (
              <optgroup key={cat} label={cat === 'crisis' ? 'Para crise' : 'Uso contínuo'}>
                {active.filter((m) => m.data.category === cat).map((m) => <option key={m.id} value={m.id}>{m.data.name}{m.data.dose ? ` ${m.data.dose} ${m.data.unit}` : ''}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        {(!medId || medId.startsWith('manual:')) && (
          <>
            <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
            <div className="dor-row">
              <Field label="Dose"><input value={dose} onChange={(e) => setDose(e.target.value)} maxLength={20} inputMode="decimal" /></Field>
              <Field label="Unidade"><input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} /></Field>
            </div>
            <Chips label="Tipo" options={['Para crise', 'Uso contínuo']} value={[category === 'crisis' ? 'Para crise' : 'Uso contínuo']} onChange={(v) => { const last = v[v.length - 1]; setCategory(last === 'Uso contínuo' ? 'continuous' : 'crisis'); }} />
          </>
        )}
        <Stepper label={`Quantidade${dose ? ` (cada uma: ${dose} ${unit})` : ''}`} value={quantity} onChange={setQuantity} />
        <DateTimeField label="Data e horário" iso={at} onChange={setAt} tz={tz} />
        {category === 'crisis' && (
          <Field label="Crise associada (opcional)">
            <select value={crisisId} onChange={(e) => setCrisisId(e.target.value)}>
              <option value="">Nenhuma</option>
              {crisisOptions.map((c) => <option key={c.id} value={c.id}>{fmtDateTime(new Date(c.data.start).getTime(), tz)}{c.data.end ? '' : ' (em andamento)'}</option>)}
            </select>
          </Field>
        )}
        <label className="dor-check"><input type="checkbox" checked={omitted} onChange={(e) => setOmitted(e.target.checked)} /> Não tomei esta dose (registrar como dose omitida)</label>
        <Field label="Observação (opcional)"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} /></Field>
        {err && <div className="dor-alert err" role="alert">{err}</div>}
        {saver.node}
        <Actions busy={saver.busy} onCancel={onClose} />
      </form>
    </Sheet>
  );
}

// ---------- sleep ----------
export function SleepForm({ store, onClose, rec, date }: Props & { rec?: Rec<Sleep>; date?: string }) {
  const [day, setDay] = useState(rec?.data.date ?? date ?? dayKey(Date.now(), store.settings.tz));
  const [hours, setHours] = useState(rec?.data.hours !== undefined ? String(rec.data.hours) : '');
  const [quality, setQuality] = useState<string[]>(rec?.data.quality ? [rec.data.quality] : []);
  const [note, setNote] = useState(rec?.data.note ?? '');
  const [err, setErr] = useState('');
  const existing = store.ctx.sleeps.find((s) => s.data.date === day && s.id !== rec?.id);
  const target = rec ?? existing;
  const saver = useSaver(store, () => onClose());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const h = hours.trim() === '' ? undefined : Number(hours.replace(',', '.'));
    if (h !== undefined && (!Number.isFinite(h) || h < 0 || h > 24)) { setErr('As horas dormidas devem estar entre 0 e 24.'); return; }
    if (h === undefined && !quality[0] && !note.trim()) { setErr('Preencha ao menos um campo do sono.'); return; }
    const data: Sleep = { date: day, hours: h, quality: (quality[0] as Sleep['quality']) || undefined, note: note.trim() || undefined };
    await saver.submit('sleep', data, `${day}T12:00:00Z`, target);
  };
  return (
    <Sheet title={target ? 'Editar sono' : 'Registrar sono'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Data referente ao sono"><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        {existing && !rec && <div className="dor-alert warn">Já existe um registro de sono neste dia; salvar vai atualizá-lo.</div>}
        <Field label="Horas dormidas (opcional)"><input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="ex.: 7,5" /></Field>
        <Chips label="Qualidade" options={['boa', 'regular', 'ruim']} value={quality} onChange={(v) => setQuality(v.slice(-1))} />
        <Field label="Observação (opcional)"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} /></Field>
        {err && <div className="dor-alert err" role="alert">{err}</div>}
        {saver.node}
        <Actions busy={saver.busy} onCancel={onClose} />
      </form>
    </Sheet>
  );
}

// ---------- physiotherapy session ----------
export function PhysioForm({ store, onClose, rec }: Props & { rec?: Rec<Physio> }) {
  const tz = store.settings.tz;
  const [at, setAt] = useState(rec?.data.at ?? nowIso());
  // the two techniques of the treatment start selected on a new session; they can be unticked
  const [techniques, setTechniques] = useState<string[]>(rec?.data.techniques ?? PHYSIO_TECHNIQUES);
  const [before, setBefore] = useState<number | null>(rec?.data.painBefore ?? null);
  const [after, setAfter] = useState<number | null>(rec?.data.painAfter ?? null);
  const [note, setNote] = useState(rec?.data.note ?? '');
  const [err, setErr] = useState('');
  const saver = useSaver(store, () => onClose());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (techniques.length === 0) { setErr('Marque ao menos uma técnica.'); return; }
    const data: Physio = { at, techniques, painBefore: before ?? undefined, painAfter: after ?? undefined, note: note.trim() || undefined };
    await saver.submit('physio', data, at, rec);
  };
  return (
    <Sheet title={rec ? 'Editar fisioterapia' : 'Registrar fisioterapia'} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="dor-muted dor-small">Fisioterapeuta: {store.settings.physio}</p>
        <Chips label="O que foi feito" options={PHYSIO_TECHNIQUES} value={techniques} onChange={setTechniques} />
        <DateTimeField label="Data e horário da sessão" iso={at} onChange={setAt} tz={tz} />
        <details className="dor-details" open={before !== null || after !== null}>
          <summary>Dor antes e depois (opcional)</summary>
          <IntensityPicker value={before} onChange={setBefore} label="Dor antes da sessão (0 a 10)" />
          <IntensityPicker value={after} onChange={setAfter} label="Dor depois da sessão (0 a 10)" />
        </details>
        <Field label="Observação (opcional)"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} /></Field>
        {err && <div className="dor-alert err" role="alert">{err}</div>}
        {saver.node}
        <Actions busy={saver.busy} onCancel={onClose} />
      </form>
    </Sheet>
  );
}

// ---------- delete + versions ----------
const OPS: Record<string, string> = { create: 'Criado', update: 'Alterado', delete: 'Excluído', restore: 'Restaurado da lixeira', restore_version: 'Versão restaurada' };

export function Versions({ store, rec, onDone }: { store: DorStore; rec: Rec; onDone: () => void }) {
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { store.api.history(rec.id).then(setList).catch((e) => setErr(e instanceof Error ? e.message : String(e))); }, [store, rec.id]);
  if (err) return <div className="dor-alert err">{err}</div>;
  if (!list) return <p className="dor-muted">Carregando histórico…</p>;
  return (
    <ul className="dor-versions">
      {[...list].reverse().map((h) => (
        <li key={h.version}>
          <div><strong>Versão {h.version}</strong> — {OPS[h.op] ?? h.op} em {fmtDateTime(new Date(h.at).getTime(), store.settings.tz)}</div>
          {h.old && h.new && <small className="dor-muted">Antes: {JSON.stringify(h.old)}</small>}
          {h.new && h.version !== rec.version && (
            <button className="dor-btn small" onClick={async () => { if ((await store.restoreVersion(rec.id, h.version)).ok) onDone(); }}>Restaurar esta versão</button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DeleteButton({ store, rec, onDone }: { store: DorStore; rec: Rec; onDone: () => void }) {
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState('');
  if (!ask) return <button type="button" className="dor-btn danger" onClick={() => setAsk(true)}>Excluir</button>;
  return (
    <div className="dor-alert err">
      Excluir este registro? Ele fica na lixeira por 30 dias.
      <div className="dor-row">
        <button type="button" className="dor-btn" onClick={() => setAsk(false)}>Não</button>
        <button type="button" className="dor-btn danger" onClick={async () => {
          const r = await store.remove(rec);
          if (r.ok) onDone(); else setMsg(r.conflict ? 'Este registro foi alterado em outro aparelho. Feche e abra de novo para ver a versão atual.' : r.error);
        }}>Sim, excluir</button>
      </div>
      {msg && <div role="alert">{msg}</div>}
    </div>
  );
}

/** Opens the right form for any record of the timeline. */
export function EditRecord({ store, rec, onClose }: Props & { rec: Rec }) {
  const [tab, setTab] = useState<'edit' | 'versions'>('edit');
  const extras = <Extras store={store} rec={rec} onClose={onClose} onVersions={() => setTab('versions')} />;
  if (rec.kind === 'crisis') return <CrisisWrap store={store} rec={rec as Rec<Crisis>} onClose={onClose} />;
  if (tab === 'versions') {
    return <Sheet title="Versões do registro" onClose={onClose}><Versions store={store} rec={rec} onDone={onClose} /><div className="dor-actions"><button className="dor-btn" onClick={() => setTab('edit')}>Voltar</button></div></Sheet>;
  }
  if (rec.kind === 'intensity') return <SheetExtra.Provider value={extras}><IntensityForm store={store} rec={rec as Rec<Intensity>} onClose={onClose} /></SheetExtra.Provider>;
  if (rec.kind === 'med_admin') return <SheetExtra.Provider value={extras}><MedAdminForm store={store} rec={rec as Rec<MedAdmin>} onClose={onClose} /></SheetExtra.Provider>;
  if (rec.kind === 'sleep') return <SheetExtra.Provider value={extras}><SleepForm store={store} rec={rec as Rec<Sleep>} onClose={onClose} /></SheetExtra.Provider>;
  if (rec.kind === 'physio') return <SheetExtra.Provider value={extras}><PhysioForm store={store} rec={rec as Rec<Physio>} onClose={onClose} /></SheetExtra.Provider>;
  const label = rec.kind === 'nopain' ? `Dia sem cefaleia confirmado: ${(rec.data as unknown as NoPain).date.split('-').reverse().join('/')}` : 'Registro';
  return (
    <Sheet title={label} onClose={onClose}>
      <div className="dor-actions"><button className="dor-btn" onClick={() => setTab('versions')}>Versões</button><DeleteButton store={store} rec={rec} onDone={onClose} /></div>
    </Sheet>
  );
}
/** Delete / versions buttons shown under the edit form of a record. */
function Extras({ store, rec, onClose, onVersions }: { store: DorStore; rec: Rec; onClose: () => void; onVersions: () => void }) {
  return <div className="dor-extras"><button className="dor-btn small" onClick={onVersions}>Ver versões</button><DeleteButton store={store} rec={rec} onDone={onClose} /></div>;
}
function CrisisWrap({ store, rec, onClose }: Props & { rec: Rec<Crisis> }) {
  const [tab, setTab] = useState<'edit' | 'versions'>('edit');
  if (tab === 'versions') return <Sheet title="Versões da crise" onClose={onClose}><Versions store={store} rec={rec} onDone={onClose} /><div className="dor-actions"><button className="dor-btn" onClick={() => setTab('edit')}>Voltar</button></div></Sheet>;
  return <SheetExtra.Provider value={<Extras store={store} rec={rec} onClose={onClose} onVersions={() => setTab('versions')} />}><CrisisForm store={store} rec={rec} onClose={onClose} /></SheetExtra.Provider>;
}
