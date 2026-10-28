// Quest Tracker data. Tables and rules: supabase/30_quest_tracker.sql. Everybody reads; only the administrator writes
// (enforced by the database). In `npm run dev` with ?fakedb the in-memory copy with ILLUSTRATIVE data is used instead.
import { supabase } from '../market/supabase';
import { sampleData } from './devSample';
import {
  DEFAULT_SETTINGS, EXP_TABLE_MODES,
  type ExpBonus, type ExpLevel, type Objective, type Quest, type QuestCategory, type QuestData, type QuestSettings, type RepeatType,
} from './types';

export class QuestUnavailableError extends Error {}

export interface LogEntry { id: number; adminId: string | null; action: string; entity: string; entityId: string | null; summary: string; at: number }

export interface QuestRepo {
  /** Public data (only what is turned on) or, for the administrator, everything including inactive and archived. */
  loadData(admin: boolean): Promise<QuestData>;
  saveQuests(quests: Quest[]): Promise<void>;
  saveCategory(c: QuestCategory): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  saveExpLevels(rows: ExpLevel[]): Promise<void>;
  deleteExpLevel(level: number): Promise<void>;
  saveSettings(s: QuestSettings): Promise<void>;
  saveBonus(b: ExpBonus): Promise<void>;
  deleteBonus(id: string): Promise<void>;
  listLog(limit: number): Promise<LogEntry[]>;
}

// ---------- row mapping ----------
type QuestRow = {
  id: string; name: string; category_id: string; min_level: number | null; max_level: number | null; map: string; npc: string; description: string;
  objectives: Objective[]; base_exp: number | string | null; prerequisites: string[]; repeat_type: RepeatType; repeat_interval_hours: number | null; active: boolean; archived: boolean;
};
const toQuest = (r: QuestRow): Quest => ({
  id: r.id, name: r.name, categoryId: r.category_id, minLevel: r.min_level, maxLevel: r.max_level, map: r.map, npc: r.npc, description: r.description,
  objectives: Array.isArray(r.objectives) ? r.objectives : [], baseExp: r.base_exp === null ? null : Number(r.base_exp), prerequisites: r.prerequisites ?? [],
  repeatType: r.repeat_type, repeatIntervalHours: r.repeat_interval_hours, active: r.active, archived: r.archived,
});
const fromQuest = (q: Quest) => ({
  id: q.id, name: q.name, category_id: q.categoryId, min_level: q.minLevel, max_level: q.maxLevel, map: q.map, npc: q.npc, description: q.description,
  objectives: q.objectives, base_exp: q.baseExp, prerequisites: q.prerequisites, repeat_type: q.repeatType,
  repeat_interval_hours: q.repeatType === 'interval' ? q.repeatIntervalHours : null, active: q.active, archived: q.archived,
});

/** Turns the database errors an administrator can cause into readable messages. */
function fail(e: { message: string; code?: string }): never {
  if (e.code === '42P01' || e.code === 'PGRST205') throw new QuestUnavailableError('migration');
  if (e.code === '23503') throw new Error('Não é possível: há registros que dependem deste (por exemplo quests nesta categoria).');
  if (e.code === '23514') throw new Error(`Valor não aceito pelo banco: ${e.message}`);
  if (e.code === '42501') throw new Error('Sem permissão: só administradores podem alterar esses dados.');
  throw new Error(e.message);
}

function createSupabaseRepo(): QuestRepo {
  const sb = () => { if (!supabase) throw new QuestUnavailableError('backend'); return supabase; };
  const check = <T>(r: { data: T; error: { message: string; code?: string } | null }): T => { if (r.error) fail(r.error); return r.data; };
  const chunks = <T>(list: T[], n: number): T[][] => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
  return {
    async loadData() {
      const [cats, quests, levels, bonuses, settings] = await Promise.all([
        sb().from('quest_categories').select('*').order('sort'),
        sb().from('quests').select('*').order('id'),
        sb().from('exp_levels').select('*').order('level'),
        sb().from('exp_bonuses').select('*').order('sort'),
        sb().from('quest_settings').select('*').eq('id', 1).maybeSingle(),
      ]);
      const s = check(settings) as Record<string, unknown> | null;
      const settingsOut: QuestSettings = s ? {
        expTableMode: (EXP_TABLE_MODES as string[]).includes(String(s.exp_table_mode)) ? (s.exp_table_mode as QuestSettings['expTableMode']) : 'per_level',
        combineMode: s.combine_mode === 'multiplicative' ? 'multiplicative' : 'additive',
        rounding: s.rounding === 'round' || s.rounding === 'ceil' ? s.rounding : 'floor',
        rules: { capPercentPerQuest: s.cap_percent_per_quest === null || s.cap_percent_per_quest === undefined ? null : Number(s.cap_percent_per_quest), overflow: s.overflow === 'lose' ? 'lose' : 'carry' },
        dataVersion: Number(s.data_version ?? 0),
      } : DEFAULT_SETTINGS;
      return {
        categories: (check(cats) as { id: string; name: string; sort: number; color: string; active: boolean; builtin: boolean }[]).map((c) => ({ ...c })),
        quests: (check(quests) as QuestRow[]).map(toQuest),
        expLevels: (check(levels) as { level: number; value: number | string; active: boolean }[]).map((l) => ({ level: l.level, value: Number(l.value), active: l.active })),
        bonuses: (check(bonuses) as { id: string; name: string; kind: 'toggle' | 'manual'; percent: number | string; enabled: boolean; applies_to: string[]; sort: number; builtin: boolean }[])
          .map((b) => ({ id: b.id, name: b.name, kind: b.kind, percent: Number(b.percent), enabled: b.enabled, appliesTo: b.applies_to ?? [], sort: b.sort, builtin: b.builtin })),
        settings: settingsOut,
      };
    },
    async saveQuests(quests) { for (const part of chunks(quests.map(fromQuest), 200)) check(await sb().from('quests').upsert(part)); },
    async saveCategory(c) { check(await sb().from('quest_categories').upsert({ id: c.id, name: c.name, sort: c.sort, color: c.color, active: c.active, builtin: c.builtin })); },
    async deleteCategory(id) { check(await sb().from('quest_categories').delete().eq('id', id)); },
    async saveExpLevels(rows) { for (const part of chunks(rows, 500)) check(await sb().from('exp_levels').upsert(part)); },
    async deleteExpLevel(level) { check(await sb().from('exp_levels').delete().eq('level', level)); },
    async saveSettings(s) {
      check(await sb().from('quest_settings').update({
        exp_table_mode: s.expTableMode, combine_mode: s.combineMode, rounding: s.rounding, cap_percent_per_quest: s.rules.capPercentPerQuest, overflow: s.rules.overflow,
      }).eq('id', 1));
    },
    async saveBonus(b) {
      check(await sb().from('exp_bonuses').upsert({ id: b.id, name: b.name, kind: b.kind, percent: b.percent, enabled: b.enabled, applies_to: b.appliesTo, sort: b.sort, builtin: b.builtin }));
    },
    async deleteBonus(id) { check(await sb().from('exp_bonuses').delete().eq('id', id)); },
    async listLog(limit) {
      const rows = check(await sb().from('quest_admin_log').select('*').order('created_at', { ascending: false }).limit(limit)) as { id: number; admin_id: string | null; action: string; entity: string; entity_id: string | null; summary: string; created_at: string }[];
      return rows.map((r) => ({ id: r.id, adminId: r.admin_id, action: r.action, entity: r.entity, entityId: r.entity_id, summary: r.summary, at: new Date(r.created_at).getTime() }));
    },
  };
}

/** In-memory copy with ILLUSTRATIVE data (development only, never in production). */
export function createMemoryRepo(): QuestRepo {
  const data = sampleData();
  const log: LogEntry[] = [];
  let seq = 0;
  const note = (action: string, entity: string, entityId: string | null, summary = '') => { log.unshift({ id: ++seq, adminId: null, action, entity, entityId, summary, at: Date.now() }); data.settings.dataVersion++; };
  const upsert = <T>(list: T[], item: T, same: (a: T) => boolean) => { const i = list.findIndex(same); if (i >= 0) list[i] = item; else list.push(item); return i >= 0 ? 'update' : 'insert'; };
  return {
    async loadData(admin) {
      const copy: QuestData = JSON.parse(JSON.stringify(data));
      if (admin) return copy;
      return {
        ...copy,
        categories: copy.categories.filter((c) => c.active),
        quests: copy.quests.filter((x) => x.active && !x.archived),
        expLevels: copy.expLevels.filter((l) => l.active),
        bonuses: copy.bonuses.filter((b) => b.enabled),
      };
    },
    async saveQuests(quests) { for (const x of quests) note(upsert(data.quests, JSON.parse(JSON.stringify(x)), (a) => a.id === x.id), 'quests', x.id, x.name); },
    async saveCategory(c) { note(upsert(data.categories, { ...c }, (a) => a.id === c.id), 'quest_categories', c.id, c.name); },
    async deleteCategory(id) {
      if (data.quests.some((x) => x.categoryId === id)) throw new Error('Não é possível: há registros que dependem deste (por exemplo quests nesta categoria).');
      data.categories = data.categories.filter((c) => c.id !== id); note('delete', 'quest_categories', id);
    },
    async saveExpLevels(rows) { for (const r of rows) note(upsert(data.expLevels, { ...r }, (a) => a.level === r.level), 'exp_levels', String(r.level)); data.expLevels.sort((a, b) => a.level - b.level); },
    async deleteExpLevel(level) { data.expLevels = data.expLevels.filter((r) => r.level !== level); note('delete', 'exp_levels', String(level)); },
    async saveSettings(s) { data.settings = { ...s, dataVersion: data.settings.dataVersion + 1 }; log.unshift({ id: ++seq, adminId: null, action: 'update', entity: 'quest_settings', entityId: '1', summary: '', at: Date.now() }); },
    async saveBonus(b) { note(upsert(data.bonuses, { ...b }, (a) => a.id === b.id), 'exp_bonuses', b.id, b.name); data.bonuses.sort((a, b2) => a.sort - b2.sort); },
    async deleteBonus(id) { data.bonuses = data.bonuses.filter((b) => b.id !== id); note('delete', 'exp_bonuses', id); },
    async listLog(limit) { return log.slice(0, limit); },
  };
}

const FAKE_KEY = 'pz-fakedb';
/** Dev only: ?fakedb (shared with the other tools) switches to the illustrative in-memory data. */
export const QUEST_FAKE: boolean = (() => {
  if (!import.meta.env.DEV) return false;
  try { return sessionStorage.getItem(FAKE_KEY) === '1' || new URLSearchParams(window.location.search).has('fakedb'); } catch { return false; }
})();

let repo: QuestRepo | null = null;
export const getQuestRepo = (): QuestRepo => (repo ??= QUEST_FAKE ? createMemoryRepo() : createSupabaseRepo());
