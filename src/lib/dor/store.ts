// State of the pain diary screen: the records as the server has them, the save indicator and the live sync.
// Nothing is shown as recorded before the server confirmed it ("Salvo" only after the answer), and nothing lives only in the browser.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../market/supabase';
import { channelName, type DorApi } from './api';
import type { Ctx } from './calc';
import { DEFAULT_TZ } from './time';
import type { AlertRule, Crisis, Intensity, Kind, Med, MedAdmin, NoPain, Physio, Rec, Settings, Sleep, SymptomUpdate, Therapy } from './types';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type Outcome = { ok: true; record: Rec } | { ok: false; conflict: true; record: Rec } | { ok: false; conflict: false; error: string };

export const DEFAULT_SETTINGS: Settings = { tz: DEFAULT_TZ, doctor: 'Dra. Dayane Almeida Schinaider', physio: 'Rafael Schinaider' };
const POLL_MS = 30000;

const sortByEvent = <T extends object>(list: Rec<T>[]) => [...list].sort((a, b) => (a.eventAt ?? a.createdAt).localeCompare(b.eventAt ?? b.createdAt));

export function useDorStore(api: DorApi, secret: string, onDenied: () => void) {
  const [records, setRecords] = useState<Rec[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [state, setState] = useState<SaveState>('idle');
  const [lastError, setLastError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const channel = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const alive = useRef(true);

  const guard = useCallback((e: unknown): string => {
    const m = e instanceof Error ? e.message : String(e);
    if (m === 'ACCESS_DENIED') { onDenied(); return 'Acesso negado.'; }
    return m;
  }, [onDenied]);

  const refresh = useCallback(async () => {
    try {
      const list = await api.list();
      if (!alive.current) return;
      setRecords(list); setLoaded(true); setLoadError('');
    } catch (e) { if (alive.current) { setLoadError(guard(e)); } }
  }, [api, guard]);

  // first load, polling, focus, and the realtime "something changed" signal
  useEffect(() => {
    alive.current = true;
    void refresh();
    const poll = setInterval(() => void refresh(), POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    const onVis = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    let off = () => {};
    if (supabase) {
      void channelName(secret).then((name) => {
        if (!alive.current || !supabase) return;
        const ch = supabase.channel(name, { config: { broadcast: { self: false } } });
        ch.on('broadcast', { event: 'changed' }, () => void refresh()).subscribe();
        channel.current = ch;
        off = () => { void supabase?.removeChannel(ch); };
      });
    }
    return () => { alive.current = false; clearInterval(poll); clearInterval(clock); document.removeEventListener('visibilitychange', onVis); off(); channel.current = null; };
  }, [refresh, secret]);

  const ping = useCallback(() => { void channel.current?.send({ type: 'broadcast', event: 'changed', payload: {} }); }, []);

  const apply = useCallback((rec: Rec) => setRecords((cur) => (cur.some((r) => r.id === rec.id) ? cur.map((r) => (r.id === rec.id ? rec : r)) : [...cur, rec])), []);

  const run = useCallback(async <T,>(job: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> => {
    setState('saving');
    try {
      const value = await job();
      setState('saved'); setLastError('');
      return { ok: true, value };
    } catch (e) {
      const error = guard(e);
      setState('error'); setLastError(error);
      return { ok: false, error };
    }
  }, [guard]);

  /** Creates (no `id`) or changes a record. A conflict is returned, never overwritten silently. */
  const save = useCallback(async (kind: Kind, data: object, eventAt: string | null, id?: string, version = 0): Promise<Outcome> => {
    const r = await run(() => api.save(id ?? null, kind, data, eventAt, version));
    if (!r.ok) return { ok: false, conflict: false, error: r.error };
    if (r.value.ok) { apply(r.value.record); ping(); return { ok: true, record: r.value.record }; }
    apply(r.value.record);
    setState('idle');
    return { ok: false, conflict: true, record: r.value.record };
  }, [api, apply, ping, run]);

  const remove = useCallback(async (rec: Rec): Promise<Outcome> => {
    const r = await run(() => api.remove(rec.id, rec.version));
    if (!r.ok) return { ok: false, conflict: false, error: r.error };
    apply(r.value.record);
    if (r.value.ok) { ping(); return { ok: true, record: r.value.record }; }
    setState('idle');
    return { ok: false, conflict: true, record: r.value.record };
  }, [api, apply, ping, run]);

  const restore = useCallback(async (id: string) => {
    const r = await run(() => api.restore(id));
    if (r.ok) { apply(r.value); ping(); }
    return r;
  }, [api, apply, ping, run]);
  const restoreVersion = useCallback(async (id: string, version: number) => {
    const r = await run(() => api.restoreVersion(id, version));
    if (r.ok) { apply(r.value); ping(); }
    return r;
  }, [api, apply, ping, run]);

  const live = useMemo(() => records.filter((r) => !r.deletedAt), [records]);
  const trash = useMemo(() => records.filter((r) => r.deletedAt).sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')), [records]);
  const of = useCallback(<T extends object>(kind: Kind) => sortByEvent(live.filter((r) => r.kind === kind) as Rec<T>[]), [live]);

  const settingsRec = of<Settings>('settings')[0] as Rec<Settings> | undefined;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(settingsRec?.data ?? {}) };
  const meds = useMemo(() => of<Med>('med').sort((a, b) => a.data.order - b.data.order), [of]);

  const ctx: Ctx = useMemo(() => ({
    tz: settings.tz, now,
    crises: of<Crisis>('crisis'), intensities: of<Intensity>('intensity'), admins: of<MedAdmin>('med_admin'),
    nopain: of<NoPain>('nopain'), sleeps: of<Sleep>('sleep'), therapy: of<Therapy>('therapy'), physio: of<Physio>('physio'),
  }), [of, settings.tz, now]);

  return {
    api, loaded, loadError, state, lastError, now, refresh, save, remove, restore, restoreVersion,
    settings, settingsRec, meds, ctx, trash,
    symptoms: of<SymptomUpdate>('symptom'), alertRules: of<AlertRule>('alert_rule'), all: records,
  };
}
export type DorStore = ReturnType<typeof useDorStore>;
