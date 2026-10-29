// Small pieces shared by the screens of the pain diary: sheet, chips, intensity picker, stepper and the saving helper
// that keeps the typed data on the screen when a save fails and shows a conflict instead of overwriting.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { DorStore, Outcome } from '../../lib/dor/store';
import { dayKey, localToMs, timeKey } from '../../lib/dor/time';
import type { Kind, Rec } from '../../lib/dor/types';

/** Lets EditRecord add delete/versions buttons under whichever form it opens. */
export const SheetExtra = createContext<ReactNode>(null);

export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const extra = useContext(SheetExtra);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="dor-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dor-sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="dor-sheet-head"><h2>{title}</h2><button className="dor-x" onClick={onClose} aria-label="Fechar">✕</button></div>
        {children}
        {extra}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="dor-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function IntensityPicker({ value, onChange, label = 'Intensidade da dor (0 a 10)' }: { value: number | null; onChange: (v: number | null) => void; label?: string }) {
  return (
    <div className="dor-field" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="dor-scale">
        {Array.from({ length: 11 }, (_, i) => (
          <button type="button" key={i} className={`dor-n i${i}${value === i ? ' on' : ''}`} aria-pressed={value === i} onClick={() => onChange(value === i ? null : i)}>{i}</button>
        ))}
      </div>
    </div>
  );
}

export function Chips({ options, value, onChange, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="dor-field" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="dor-chips">{options.map((o) => <button type="button" key={o} className={`dor-chip${value.includes(o) ? ' on' : ''}`} aria-pressed={value.includes(o)} onClick={() => toggle(o)}>{o}</button>)}</div>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0.5, step = 0.5, label }: { value: number; onChange: (v: number) => void; min?: number; step?: number; label: string }) {
  return (
    <div className="dor-field" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="dor-stepper">
        <button type="button" onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))} aria-label="Diminuir">−</button>
        <output>{String(value).replace('.', ',')}</output>
        <button type="button" onClick={() => onChange(Math.round((value + step) * 100) / 100)} aria-label="Aumentar">+</button>
      </div>
    </div>
  );
}

/** Date + time inputs backed by an ISO instant, in the diary's time zone. */
export function DateTimeField({ label, iso, onChange, tz, optional }: { label: string; iso: string; onChange: (iso: string) => void; tz: string; optional?: boolean }) {
  const t = iso ? new Date(iso).getTime() : 0;
  const date = iso ? dayKey(t, tz) : '';
  const time = iso ? timeKey(t, tz) : '';
  const set = (d: string, h: string) => { if (!d) { onChange(''); return; } onChange(new Date(localToMs(d, h || '00:00', tz)).toISOString()); };
  return (
    <div className="dor-field" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="dor-row">
        <input type="date" value={date} onChange={(e) => set(e.target.value, time || '12:00')} aria-label={`${label} — data`} />
        <input type="time" value={time} onChange={(e) => set(date, e.target.value)} aria-label={`${label} — horário`} disabled={!date} />
        {optional && date && <button type="button" className="dor-link" onClick={() => onChange('')}>limpar</button>}
      </div>
    </div>
  );
}

export const nowIso = () => new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();

// ---------- saving ----------
const labelOf = (k: string) => k;
/** Fields that differ between what this screen was saving and what the server has now. */
export function diffFields(mine: Record<string, unknown>, theirs: Record<string, unknown>): { field: string; mine: string; theirs: string }[] {
  const keys = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])];
  const show = (v: unknown) => (v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') || '—' : typeof v === 'object' && v ? JSON.stringify(v) : String(v));
  return keys.filter((k) => JSON.stringify(mine[k] ?? null) !== JSON.stringify(theirs[k] ?? null)).map((k) => ({ field: labelOf(k), mine: show(mine[k]), theirs: show(theirs[k]) }));
}

/** Runs a save from a form. On a network/server error the form stays as typed with a retry; on a conflict it lists the differences. */
export function useSaver(store: DorStore, onDone: (rec: Rec) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<{ mine: Record<string, unknown>; server: Rec; kind: Kind; eventAt: string | null } | null>(null);

  const submit = async (kind: Kind, data: object, eventAt: string | null, rec?: Rec): Promise<Rec | null> => {
    setBusy(true); setError('');
    const r: Outcome = await store.save(kind, data, eventAt, rec?.id, rec?.version);
    setBusy(false);
    if (r.ok) { onDone(r.record); return r.record; }
    if (r.conflict) { setConflict({ mine: data as Record<string, unknown>, server: r.record, kind, eventAt }); return null; }
    setError(r.error);
    return null;
  };
  const node = (
    <>
      {error && <div className="dor-alert err" role="alert">Não foi possível salvar: {error} <strong>Nada foi registrado.</strong> Seus dados continuam na tela; toque em Salvar para tentar de novo.</div>}
      {conflict && (
        <div className="dor-alert warn" role="alert">
          <strong>Este registro foi alterado em outro aparelho enquanto você editava.</strong>
          <table className="dor-diff"><thead><tr><th>Campo</th><th>Seu</th><th>Atual</th></tr></thead>
            <tbody>{diffFields(conflict.mine, conflict.server.data as Record<string, unknown>).map((d) => <tr key={d.field}><td>{d.field}</td><td>{d.mine}</td><td>{d.theirs}</td></tr>)}</tbody></table>
          <div className="dor-row">
            <button type="button" className="dor-btn" onClick={() => { onDone(conflict.server); }}>Usar a versão atual</button>
            <button type="button" className="dor-btn primary" onClick={async () => { const c = conflict; setConflict(null); await submit(c.kind, c.mine, c.eventAt, c.server); }}>Manter a minha</button>
          </div>
        </div>
      )}
    </>
  );
  return { busy, submit, node };
}
