// Bulk import / export of quests and of the EXP table (CSV or JSON), with validation and a preview before anything is saved.
// Nothing is written here: the functions return what WOULD happen, so the administrator confirms first.
import { validateExpRows } from './exp';
import {
  OBJECTIVE_KINDS, REPEAT_TYPES,
  type ExpLevel, type ExpTableMode, type Objective, type ObjectiveKind, type Quest, type QuestCategory, type RepeatType,
} from './types';

// ---------- CSV ----------

/** Parses CSV text (quotes, escaped quotes, ',' ';' or tab as the separator, detected from the first line). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = [',', ';', '\t'].map((s) => ({ s, n: firstLine.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') { if (clean[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const csvCell = (v: string): string => (/[",;\n\r\t]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const toCsv = (rows: string[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\n');

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- quests ----------

const QUEST_FIELDS = ['id', 'name', 'category', 'minLevel', 'maxLevel', 'map', 'npc', 'description', 'objectives', 'baseExp', 'prerequisites', 'repeatType', 'repeatIntervalHours', 'active'] as const;
type QuestField = (typeof QUEST_FIELDS)[number];

const ALIASES: Record<string, QuestField> = {
  id: 'id', codigo: 'id', questid: 'id',
  name: 'name', nome: 'name', nomeoficial: 'name', quest: 'name',
  category: 'category', categoria: 'category', categoryid: 'category',
  minlevel: 'minLevel', levelminimo: 'minLevel', levelmin: 'minLevel', nivelminimo: 'minLevel', minlvl: 'minLevel',
  maxlevel: 'maxLevel', levelmaximo: 'maxLevel', levelmax: 'maxLevel', nivelmaximo: 'maxLevel', maxlvl: 'maxLevel',
  map: 'map', mapa: 'map',
  npc: 'npc',
  description: 'description', descricao: 'description',
  objectives: 'objectives', objetivos: 'objectives',
  baseexp: 'baseExp', exp: 'baseExp', expbase: 'baseExp', experiencia: 'baseExp',
  prerequisites: 'prerequisites', prerequisitos: 'prerequisites', requisitos: 'prerequisites',
  repeattype: 'repeatType', repeticao: 'repeatType', tipoderepeticao: 'repeatType', repeat: 'repeatType',
  repeatintervalhours: 'repeatIntervalHours', intervalo: 'repeatIntervalHours', intervalodorepeticao: 'repeatIntervalHours', intervalohoras: 'repeatIntervalHours', repeatinterval: 'repeatIntervalHours',
  active: 'active', ativo: 'active', status: 'active',
};

/** A record from a file: the values that were present and the names of the fields that were present at all. */
export interface RawQuest { line: number; values: Partial<Record<QuestField, unknown>>; provided: Set<QuestField> }

/** Reads a CSV or JSON text into raw quest records (the header names may be in English or Portuguese). */
export function parseQuestFile(text: string): { records: RawQuest[]; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { records: [], error: 'arquivo vazio' };
  const make = (obj: Record<string, unknown>, line: number): RawQuest => {
    const values: Partial<Record<QuestField, unknown>> = {};
    const provided = new Set<QuestField>();
    for (const [k, v] of Object.entries(obj)) {
      const field = ALIASES[norm(k)];
      if (!field) continue;
      values[field] = v;
      provided.add(field);
    }
    return { line, values, provided };
  };
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      const arr = Array.isArray(data) ? data : Array.isArray(data?.quests) ? data.quests : null;
      if (!arr) return { records: [], error: 'o JSON deve ser uma lista de quests (ou { "quests": [...] })' };
      return { records: arr.map((o: unknown, i: number) => make(o && typeof o === 'object' ? (o as Record<string, unknown>) : {}, i + 1)) };
    } catch (e) {
      return { records: [], error: `JSON inválido: ${(e as Error).message}` };
    }
  }
  const rows = parseCsv(trimmed);
  if (rows.length < 2) return { records: [], error: 'o CSV precisa de uma linha de cabeçalho e ao menos uma quest' };
  const header = rows[0];
  return { records: rows.slice(1).map((r, i) => make(Object.fromEntries(header.map((h, c) => [h, r[c] ?? ''])), i + 2)) };
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const isEmpty = (v: unknown): boolean => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

function toBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  const s = norm(str(v));
  if (['true', '1', 'sim', 'yes', 'ativo', 'active', 'on'].includes(s)) return true;
  if (['false', '0', 'nao', 'no', 'inativo', 'inactive', 'off'].includes(s)) return false;
  return null;
}

const REPEAT_ALIASES: Record<string, RepeatType> = {
  once: 'once', unica: 'once', unico: 'once', uma: 'once', nenhuma: 'once', none: 'once',
  repeatable: 'repeatable', repetivel: 'repeatable', repeticao: 'repeatable',
  daily: 'daily', diaria: 'daily', diario: 'daily',
  interval: 'interval', intervalo: 'interval',
};

/** "monster:Nome x10|boss:Nome|item:Nome x5" -> objectives; a JSON array of objects is accepted too. */
export function parseObjectives(v: unknown): { list: Objective[]; error?: string } {
  if (Array.isArray(v)) {
    const list: Objective[] = [];
    for (const o of v) {
      if (!o || typeof o !== 'object') return { list: [], error: 'objetivo inválido' };
      const r = o as Record<string, unknown>;
      const kind = norm(str(r.kind ?? r.tipo)) as ObjectiveKind;
      const qty = isEmpty(r.qty ?? r.quantidade) ? null : Number(r.qty ?? r.quantidade);
      if (qty !== null && (!Number.isInteger(qty) || qty < 0)) return { list: [], error: 'quantidade de objetivo inválida' };
      list.push({ kind: OBJECTIVE_KINDS.includes(kind) ? kind : 'other', name: str(r.name ?? r.nome), qty });
    }
    return { list };
  }
  const text = str(v);
  if (!text) return { list: [] };
  const list: Objective[] = [];
  for (const part of text.split('|')) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(?:(monster|monstro|boss|item|other|outro)\s*:\s*)?(.*?)(?:\s+[xX×]\s*(\d+))?$/);
    if (!m || !m[2].trim()) return { list: [], error: `objetivo inválido: "${p}"` };
    const kindRaw = (m[1] ?? 'other').toLowerCase();
    const kind: ObjectiveKind = kindRaw === 'monstro' ? 'monster' : kindRaw === 'outro' ? 'other' : (kindRaw as ObjectiveKind);
    list.push({ kind, name: m[2].trim(), qty: m[3] ? Number(m[3]) : null });
  }
  return { list };
}

export const objectivesToText = (list: Objective[]): string => list.map((o) => `${o.kind}:${o.name}${o.qty !== null ? ` x${o.qty}` : ''}`).join('|');

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x)).filter(Boolean);
  return str(v).split(/[|;]/).map((x) => x.trim()).filter(Boolean);
}

function toInt(v: unknown, label: string, errors: string[], min = 0): number | null {
  if (isEmpty(v)) return null;
  const n = typeof v === 'number' ? v : Number(str(v).replace(/\./g, '').replace(',', '.'));
  if (!Number.isInteger(n) || n < min) { errors.push(`${label} inválido: "${str(v)}"`); return null; }
  return n;
}

/** Field-by-field rules for one quest (used by the import and by the admin form). */
export function validateQuest(q: Quest, categories: QuestCategory[], knownIds: Set<string>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  if (!q.id.trim()) errors.push('ID obrigatório');
  if (/\s/.test(q.id)) errors.push('o ID não pode ter espaços');
  if (!q.name.trim()) errors.push('nome obrigatório');
  if (!categories.some((c) => c.id === q.categoryId)) errors.push(`categoria desconhecida: "${q.categoryId}"`);
  if (q.minLevel !== null && q.minLevel < 1) errors.push('level mínimo deve ser 1 ou mais');
  if (q.minLevel !== null && q.maxLevel !== null && q.maxLevel < q.minLevel) errors.push('level máximo menor que o mínimo');
  if (q.baseExp !== null && (!Number.isInteger(q.baseExp) || q.baseExp < 0)) errors.push('EXP base inválida');
  if (q.baseExp === null) warnings.push('EXP base não cadastrada: a quest não entra nos cálculos');
  if (q.repeatType === 'interval' && !(q.repeatIntervalHours && q.repeatIntervalHours > 0)) errors.push('quest com intervalo precisa de horas de intervalo (> 0)');
  if (q.prerequisites.includes(q.id)) errors.push('a quest não pode ser pré-requisito dela mesma');
  for (const p of q.prerequisites) if (p !== q.id && !knownIds.has(p)) warnings.push(`pré-requisito "${p}" não existe (ainda)`);
  return { errors, warnings };
}

export type ImportAction = 'new' | 'update' | 'same' | 'skip' | 'error';
export interface QuestImportRow { line: number; id: string; action: ImportAction; errors: string[]; warnings: string[]; changes: string[]; quest: Quest | null }
export interface QuestImportPreview {
  rows: QuestImportRow[];
  counts: Record<ImportAction, number>;
  /** The quests that would be saved (new + updates) when the administrator confirms. */
  toSave: Quest[];
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Compares the file with what is already registered. Existing quests are only touched when `updateExisting` is on, and then
 * only the columns present in the file change (an absent column never wipes a value).
 */
export function buildQuestImport(records: RawQuest[], existing: Quest[], categories: QuestCategory[], updateExisting: boolean): QuestImportPreview {
  const byId = new Map(existing.map((q) => [q.id, q]));
  const catOf = (v: string): string | null => {
    const n = norm(v);
    return categories.find((c) => norm(c.id) === n || norm(c.name) === n)?.id ?? null;
  };
  const fileIds = new Set(records.map((r) => str(r.values.id)).filter(Boolean));
  const known = new Set([...byId.keys(), ...fileIds]);
  const seen = new Map<string, number>();
  const rows: QuestImportRow[] = [];

  for (const r of records) {
    const errors: string[] = [];
    const id = str(r.values.id);
    const row: QuestImportRow = { line: r.line, id, action: 'error', errors, warnings: [], changes: [], quest: null };
    rows.push(row);
    if (!id) { errors.push('ID obrigatório'); continue; }
    if (seen.has(id)) { errors.push(`ID duplicado no arquivo (também na linha ${seen.get(id)})`); continue; }
    seen.set(id, r.line);

    const cur = byId.get(id);
    const has = (f: QuestField) => r.provided.has(f);
    const draft: Quest = cur ? { ...cur } : {
      id, name: '', categoryId: '', minLevel: null, maxLevel: null, map: '', npc: '', description: '', objectives: [], baseExp: null,
      prerequisites: [], repeatType: 'once', repeatIntervalHours: null, active: true, archived: false,
    };
    if (has('name')) draft.name = str(r.values.name);
    if (has('category')) {
      const c = catOf(str(r.values.category));
      if (c) draft.categoryId = c; else errors.push(`categoria desconhecida: "${str(r.values.category)}"`);
    }
    if (has('minLevel')) draft.minLevel = toInt(r.values.minLevel, 'level mínimo', errors, 1);
    if (has('maxLevel')) draft.maxLevel = toInt(r.values.maxLevel, 'level máximo', errors, 1);
    if (has('map')) draft.map = str(r.values.map);
    if (has('npc')) draft.npc = str(r.values.npc);
    if (has('description')) draft.description = str(r.values.description);
    if (has('objectives')) { const o = parseObjectives(r.values.objectives); if (o.error) errors.push(o.error); else draft.objectives = o.list; }
    if (has('baseExp')) draft.baseExp = toInt(r.values.baseExp, 'EXP base', errors, 0);
    if (has('prerequisites')) draft.prerequisites = parseList(r.values.prerequisites);
    if (has('repeatType') && !isEmpty(r.values.repeatType)) {
      const rt = REPEAT_ALIASES[norm(str(r.values.repeatType))];
      if (rt && REPEAT_TYPES.includes(rt)) draft.repeatType = rt; else errors.push(`tipo de repetição desconhecido: "${str(r.values.repeatType)}"`);
    }
    if (has('repeatIntervalHours')) draft.repeatIntervalHours = toInt(r.values.repeatIntervalHours, 'intervalo de repetição', errors, 1);
    if (has('active') && !isEmpty(r.values.active)) {
      const b = toBool(r.values.active);
      if (b === null) errors.push(`valor de ativo inválido: "${str(r.values.active)}"`); else draft.active = b;
    }
    if (draft.repeatType === 'daily' || draft.repeatType === 'repeatable') draft.repeatIntervalHours = draft.repeatType === 'daily' ? null : draft.repeatIntervalHours;

    const v = validateQuest(draft, categories, known);
    const catAlready = errors.some((m) => m.startsWith('categoria desconhecida'));
    errors.push(...v.errors.filter((m) => !errors.includes(m) && !(catAlready && m.startsWith('categoria desconhecida'))));
    row.warnings = v.warnings;
    row.quest = draft;
    if (errors.length) { row.action = 'error'; continue; }

    if (!cur) { row.action = 'new'; continue; }
    if (!updateExisting) { row.action = 'skip'; row.warnings.push('já existe; a atualização de quests existentes está desligada'); continue; }
    const diff = (Object.keys(draft) as (keyof Quest)[]).filter((k) => !sameJson(draft[k], cur[k]));
    row.changes = diff.map(String);
    row.action = diff.length ? 'update' : 'same';
  }

  const counts: Record<ImportAction, number> = { new: 0, update: 0, same: 0, skip: 0, error: 0 };
  for (const r of rows) counts[r.action]++;
  return { rows, counts, toSave: rows.filter((r) => (r.action === 'new' || r.action === 'update') && r.quest).map((r) => r.quest as Quest) };
}

export const questsToJson = (quests: Quest[]): string => JSON.stringify(quests, null, 2);

export function questsToCsv(quests: Quest[], categories: QuestCategory[]): string {
  const catName = new Map(categories.map((c) => [c.id, c.id]));
  const head = ['id', 'name', 'category', 'minLevel', 'maxLevel', 'map', 'npc', 'description', 'objectives', 'baseExp', 'prerequisites', 'repeatType', 'repeatIntervalHours', 'active'];
  const rows = quests.map((q) => [
    q.id, q.name, catName.get(q.categoryId) ?? q.categoryId, q.minLevel === null ? '' : String(q.minLevel), q.maxLevel === null ? '' : String(q.maxLevel),
    q.map, q.npc, q.description, objectivesToText(q.objectives), q.baseExp === null ? '' : String(q.baseExp), q.prerequisites.join('|'),
    q.repeatType, q.repeatIntervalHours === null ? '' : String(q.repeatIntervalHours), q.active ? 'true' : 'false',
  ]);
  return toCsv([head, ...rows]);
}

// ---------- EXP table ----------

export interface ExpImportRow { line: number; level: number | null; action: ImportAction; errors: string[]; level_row: ExpLevel | null }
export interface ExpImportPreview {
  rows: ExpImportRow[];
  counts: Record<ImportAction, number>;
  /** Problems in the table that would result from applying the file (gaps, repeated levels, wrong order...). */
  tableIssues: { level?: number; message: string }[];
  toSave: ExpLevel[];
}

/** Reads rows with level and value (CSV with headers level,value[,active] or JSON). */
export function parseExpFile(text: string): { records: { line: number; level: unknown; value: unknown; active: unknown }[]; error?: string } {
  const t = text.trim();
  if (!t) return { records: [], error: 'arquivo vazio' };
  const pick = (o: Record<string, unknown>) => {
    const get = (...names: string[]) => { for (const [k, v] of Object.entries(o)) if (names.includes(norm(k))) return v; return undefined; };
    return { level: get('level', 'lvl', 'nivel'), value: get('value', 'exp', 'valor', 'experiencia', 'expnecessaria', 'expacumulada'), active: get('active', 'ativo') };
  };
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      const data = JSON.parse(t);
      const arr = Array.isArray(data) ? data : Array.isArray(data?.levels) ? data.levels : null;
      if (!arr) return { records: [], error: 'o JSON deve ser uma lista de { level, value }' };
      return { records: arr.map((o: unknown, i: number) => ({ line: i + 1, ...pick(o && typeof o === 'object' ? (o as Record<string, unknown>) : {}) })) };
    } catch (e) {
      return { records: [], error: `JSON inválido: ${(e as Error).message}` };
    }
  }
  const rows = parseCsv(t);
  if (rows.length < 2) return { records: [], error: 'o CSV precisa de uma linha de cabeçalho (level,value) e ao menos um level' };
  const header = rows[0];
  return { records: rows.slice(1).map((r, i) => ({ line: i + 2, ...pick(Object.fromEntries(header.map((h, c) => [h, r[c] ?? '']))) })) };
}

export function buildExpImport(records: ReturnType<typeof parseExpFile>['records'], existing: ExpLevel[], mode: ExpTableMode): ExpImportPreview {
  const byLevel = new Map(existing.map((r) => [r.level, r]));
  const seen = new Map<number, number>();
  const rows: ExpImportRow[] = [];
  const incoming: ExpLevel[] = [];
  for (const rec of records) {
    const errors: string[] = [];
    const level = typeof rec.level === 'number' ? rec.level : Number(str(rec.level));
    const value = typeof rec.value === 'number' ? rec.value : Number(str(rec.value).replace(/[.\s]/g, '').replace(',', '.'));
    const row: ExpImportRow = { line: rec.line, level: Number.isInteger(level) ? level : null, action: 'error', errors, level_row: null };
    rows.push(row);
    if (!Number.isInteger(level) || level < 1) { errors.push(`level inválido: "${str(rec.level)}"`); continue; }
    if (!Number.isInteger(value) || value < 0) { errors.push(`valor de EXP inválido: "${str(rec.value)}"`); continue; }
    if (value > Number.MAX_SAFE_INTEGER) { errors.push('valor de EXP grande demais'); continue; }
    if (seen.has(level)) { errors.push(`level ${level} repetido no arquivo (também na linha ${seen.get(level)})`); continue; }
    seen.set(level, rec.line);
    const active = isEmpty(rec.active) ? true : toBool(rec.active) ?? true;
    const lr: ExpLevel = { level, value, active };
    row.level_row = lr;
    incoming.push(lr);
    const cur = byLevel.get(level);
    row.action = !cur ? 'new' : cur.value === value && cur.active === active ? 'same' : 'update';
  }
  const counts: Record<ImportAction, number> = { new: 0, update: 0, same: 0, skip: 0, error: 0 };
  for (const r of rows) counts[r.action]++;
  const merged = new Map(existing.map((r) => [r.level, r]));
  for (const r of incoming) merged.set(r.level, r);
  const tableIssues = validateExpRows([...merged.values()], mode);
  return { rows, counts, tableIssues, toSave: rows.filter((r) => (r.action === 'new' || r.action === 'update') && r.level_row).map((r) => r.level_row as ExpLevel) };
}

export const expToJson = (rows: ExpLevel[]): string => JSON.stringify([...rows].sort((a, b) => a.level - b.level), null, 2);
export const expToCsv = (rows: ExpLevel[]): string => toCsv([['level', 'value', 'active'], ...[...rows].sort((a, b) => a.level - b.level).map((r) => [String(r.level), String(r.value), r.active ? 'true' : 'false'])]);
