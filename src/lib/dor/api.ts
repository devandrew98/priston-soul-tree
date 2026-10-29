// Access to the pain diary database. Every call carries the private secret and the server checks it (supabase/35_dor_diary.sql);
// the tables themselves are closed, so nothing can be read or written without it.
import { supabase } from '../market/supabase';
import type { Kind, Rec } from './types';

export interface HistoryEntry { version: number; op: 'create' | 'update' | 'delete' | 'restore' | 'restore_version'; old: object | null; new: object | null; at: string }
export type SaveResult = { ok: true; record: Rec } | { ok: false; conflict: true; record: Rec };
export interface BackupFile { exportedAt: string; records: Rec[]; history: { recordId: string; version: number; op: string; old: unknown; new: unknown; at: string }[] }

export interface DorApi {
  list(): Promise<Rec[]>;
  save(id: string | null, kind: Kind, data: object, eventAt: string | null, expected: number): Promise<SaveResult>;
  remove(id: string, expected: number): Promise<SaveResult>;
  restore(id: string): Promise<Rec>;
  history(id: string): Promise<HistoryEntry[]>;
  restoreVersion(id: string, version: number): Promise<Rec>;
  exportAll(): Promise<BackupFile>;
  rotate(newSecret: string): Promise<void>;
}

// ---------- the private secret ----------
const KEY = 'pz-dor-k';
/** Takes the secret from the address (#k=...) once, keeps it in this browser and removes it from the address bar. */
export function readSecret(): string | null {
  try {
    const m = /(?:^#|&)k=([A-Za-z0-9_-]{32,200})/.exec(window.location.hash);
    if (m) {
      localStorage.setItem(KEY, m[1]);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return m[1];
    }
    return localStorage.getItem(KEY);
  } catch { return null; }
}
export function storeSecret(s: string): void { try { localStorage.setItem(KEY, s); } catch { /* the secret then lasts until the page closes */ } }
export function forgetSecret(): void { try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ } }
/** The password never leaves the browser: only this key derived from it (PBKDF2, 200k rounds) is sent and checked by the server. */
export async function deriveSecret(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('pristonzone-dor-v1'), iterations: 200000 }, key, 256);
  return Array.from(new Uint8Array(bits), (x) => x.toString(16).padStart(2, '0')).join('');
}
/** Name of the realtime channel: derived from the secret, so only who holds the link can listen. It carries no data, only "something changed". */
export async function channelName(secret: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`dor-channel:${secret}`));
  return 'dor-' + Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

export const DOR_FAKE: boolean = (() => {
  if (!import.meta.env.DEV) return false;
  try { return new URLSearchParams(window.location.search).has('fakedb') || sessionStorage.getItem('pz-fakedb') === '1'; } catch { return false; }
})();

function fail(e: { message: string; code?: string } | null): never {
  if (e?.code === '42501' || /acesso negado/.test(e?.message ?? '')) throw new Error('ACCESS_DENIED');
  if (e?.code === '42883' || e?.code === 'PGRST202') throw new Error('Banco ainda não configurado: rode o SQL 35_dor_diary.sql no Supabase.');
  throw new Error(e?.message ?? 'Erro desconhecido');
}

export function supabaseApi(secret: string): DorApi {
  const call = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
    if (!supabase) throw new Error('Sem conexão com o banco.');
    const { data, error } = await supabase.rpc(fn, { s: secret, ...args });
    if (error) fail(error);
    if (data && !Array.isArray(data) && (data as { denied?: boolean }).denied) throw new Error('ACCESS_DENIED');
    return data as T;
  };
  return {
    list: () => call<Rec[]>('dor_list', {}),
    save: (id, kind, data, eventAt, expected) => call<SaveResult>('dor_save', { p_id: id, p_kind: kind, p_data: data, p_event_at: eventAt, p_expected: expected }),
    remove: (id, expected) => call<SaveResult>('dor_delete', { p_id: id, p_expected: expected }),
    restore: async (id) => (await call<{ record: Rec }>('dor_restore', { p_id: id })).record,
    history: (id) => call<HistoryEntry[]>('dor_history', { p_id: id }),
    restoreVersion: async (id, version) => (await call<{ record: Rec }>('dor_restore_version', { p_id: id, p_version: version })).record,
    exportAll: () => call<BackupFile>('dor_export', {}),
    rotate: async (n) => { await call<null>('dor_rotate', { new_secret: n }); },
  };
}

/** Dev only (?fakedb): the same rules as the server, in memory, to try the screens without the database. Nothing is persisted. */
export function memoryApi(): DorApi {
  const rows = new Map<string, Rec>();
  const hist: { id: string; entry: HistoryEntry }[] = [];
  let seq = 0;
  const now = () => new Date().toISOString();
  const log = (id: string, version: number, op: HistoryEntry['op'], old: Rec['data'] | null, nw: Rec['data'] | null) => hist.push({ id, entry: { version, op, old, new: nw, at: now() } });
  const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 40));
  return {
    list: () => wait([...rows.values()].filter((r) => !r.deletedAt || Date.now() - +new Date(r.deletedAt) < 30 * 86400000)),
    async save(id, kind, data, eventAt, expected) {
      if (!id) {
        const r: Rec = { id: `m${++seq}-${Math.random().toString(36).slice(2, 8)}`, kind, data: data as Rec['data'], eventAt, version: 1, createdAt: now(), updatedAt: now(), deletedAt: null };
        rows.set(r.id, r); log(r.id, 1, 'create', null, r.data);
        return wait({ ok: true as const, record: r });
      }
      const cur = rows.get(id);
      if (!cur) throw new Error('registro não existe');
      if (cur.version !== expected) return wait({ ok: false as const, conflict: true as const, record: cur });
      const old = cur.data;
      const r: Rec = { ...cur, data: data as Rec['data'], eventAt, version: cur.version + 1, updatedAt: now() };
      rows.set(id, r); log(id, r.version, 'update', old, r.data);
      return wait({ ok: true as const, record: r });
    },
    async remove(id, expected) {
      const cur = rows.get(id);
      if (!cur) throw new Error('registro não existe');
      if (cur.version !== expected) return wait({ ok: false as const, conflict: true as const, record: cur });
      const r: Rec = { ...cur, deletedAt: now(), version: cur.version + 1, updatedAt: now() };
      rows.set(id, r); log(id, r.version, 'delete', cur.data, null);
      return wait({ ok: true as const, record: r });
    },
    async restore(id) {
      const cur = rows.get(id);
      if (!cur?.deletedAt) throw new Error('registro não está na lixeira');
      const r: Rec = { ...cur, deletedAt: null, version: cur.version + 1, updatedAt: now() };
      rows.set(id, r); log(id, r.version, 'restore', null, r.data);
      return wait(r);
    },
    history: (id) => wait(hist.filter((h) => h.id === id).map((h) => h.entry)),
    async restoreVersion(id, version) {
      const cur = rows.get(id);
      const target = [...hist].reverse().find((h) => h.id === id && h.entry.version === version && h.entry.new)?.entry.new;
      if (!cur || !target) throw new Error('versão não encontrada');
      const r: Rec = { ...cur, data: target as Rec['data'], deletedAt: null, version: cur.version + 1, updatedAt: now() };
      rows.set(id, r); log(id, r.version, 'restore_version', cur.data, r.data);
      return wait(r);
    },
    exportAll: () => wait({ exportedAt: now(), records: [...rows.values()], history: hist.map((h) => ({ recordId: h.id, ...h.entry })) }),
    async rotate() { /* nothing to rotate in memory */ },
  };
}
