// The player's characters: level, EXP %, bonuses, quest progress and saved plans. Signed in: saved in the account (RLS: only the
// owner sees them). Not signed in: kept in this browser. Never mixed with the official quest data.
import { supabase } from '../market/supabase';
import { STORED_STATUSES, type BonusChoice, type Character, type QuestProgress, type SavedPlan } from './types';

const LOCAL_KEY = 'pz-quest-characters-v1';
export const MAX_CHARACTERS = 20;

const num = (v: unknown, fallback: number): number => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function newCharacter(name = ''): Character {
  return { id: crypto.randomUUID(), name, level: 1, expPct: 0, bonuses: {}, progress: {}, plans: [], updatedAt: Date.now() };
}

function sanitizeProgress(raw: unknown): Record<string, QuestProgress> {
  const out: Record<string, QuestProgress> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const p = v as Record<string, unknown>;
    if (!(STORED_STATUSES as readonly string[]).includes(String(p.status))) continue;
    const deliveries = Array.isArray(p.deliveries) ? p.deliveries.map((d) => num(d, NaN)).filter((d) => Number.isFinite(d)).sort((a, b) => a - b).slice(-200) : [];
    out[id] = { status: p.status as QuestProgress['status'], deliveries, updatedAt: num(p.updatedAt, 0) };
  }
  return out;
}

function sanitizeBonuses(raw: unknown): Record<string, BonusChoice> {
  const out: Record<string, BonusChoice> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const b = v as Record<string, unknown>;
    out[id] = { on: !!b.on, ...(b.percent !== undefined ? { percent: clamp(num(b.percent, 0), 0, 1000) } : {}) };
  }
  return out;
}

function sanitizePlans(raw: unknown): SavedPlan[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedPlan[] = [];
  for (const v of raw.slice(0, 50)) {
    if (!v || typeof v !== 'object') continue;
    const p = v as Record<string, unknown>;
    const t = (p.target ?? {}) as Record<string, unknown>;
    const s = p.summary && typeof p.summary === 'object' ? (p.summary as Record<string, unknown>) : null;
    out.push({
      id: String(p.id ?? crypto.randomUUID()).slice(0, 60),
      name: String(p.name ?? '').slice(0, 60),
      questIds: Array.isArray(p.questIds) ? p.questIds.map(String).slice(0, 200) : [],
      target: { level: clamp(Math.round(num(t.level, 1)), 1, 999), pct: clamp(num(t.pct, 0), 0, 99.9999) },
      dataVersion: num(p.dataVersion, 0),
      createdAt: num(p.createdAt, 0),
      summary: s ? { finalLevel: Math.round(num(s.finalLevel, 0)), finalPct: num(s.finalPct, 0), preGainExp: s.preGainExp === null || s.preGainExp === undefined ? null : num(s.preGainExp, 0) } : null,
    });
  }
  return out;
}

/** Whatever was stored (local storage or database) is cleaned before the app uses it. */
export function sanitizeCharacter(raw: unknown): Character | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  return {
    id: r.id,
    name: String(r.name ?? '').slice(0, 40),
    level: clamp(Math.round(num(r.level, 1)), 1, 999),
    expPct: clamp(num(r.expPct, 0), 0, 99.999999),
    bonuses: sanitizeBonuses(r.bonuses),
    progress: sanitizeProgress(r.progress),
    plans: sanitizePlans(r.plans),
    updatedAt: num(r.updatedAt, 0),
  };
}

export interface CharacterStore {
  list(): Promise<Character[]>;
  save(c: Character): Promise<void>;
  remove(id: string): Promise<void>;
}

export function createLocalStore(): CharacterStore {
  const read = (): Character[] => {
    try { return (JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as unknown[]).map(sanitizeCharacter).filter((c): c is Character => !!c); } catch { return []; }
  };
  const write = (list: Character[]) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* storage full or blocked: the session still works */ } };
  return {
    async list() { return read(); },
    async save(c) { const list = read(); const i = list.findIndex((x) => x.id === c.id); if (i >= 0) list[i] = c; else list.push(c); write(list); },
    async remove(id) { write(read().filter((c) => c.id !== id)); },
  };
}

type CharRow = { id: string; name: string; level: number; exp_pct: number | string; bonuses: unknown; progress: unknown; plans: unknown; updated_at: string };

export function createAccountStore(): CharacterStore {
  const sb = () => { if (!supabase) throw new Error('backend_not_configured'); return supabase; };
  return {
    async list() {
      const { data, error } = await sb().from('quest_characters').select('*').order('created_at');
      if (error) throw new Error(error.message);
      return (data as CharRow[]).map((r) => sanitizeCharacter({ id: r.id, name: r.name, level: r.level, expPct: Number(r.exp_pct), bonuses: r.bonuses, progress: r.progress, plans: r.plans, updatedAt: new Date(r.updated_at).getTime() })).filter((c): c is Character => !!c);
    },
    async save(c) {
      const { error } = await sb().from('quest_characters').upsert({ id: c.id, name: c.name, level: c.level, exp_pct: Math.min(c.expPct, 99.999999), bonuses: c.bonuses, progress: c.progress, plans: c.plans });
      if (error) throw new Error(error.message);
    },
    async remove(id) {
      const { error } = await sb().from('quest_characters').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}
