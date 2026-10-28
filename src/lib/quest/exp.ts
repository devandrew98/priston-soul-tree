// Exact EXP arithmetic. EXP is always an absolute integer; percentages are only for typing and showing.
// Products and divisions go through BigInt so there is no floating point error, whatever the size of the values.
import type { ExpLevel, ExpTableMode, RoundingMode } from './types';

/** floor(a * num / den) with the chosen rounding, exact. `a` and `num` are non-negative integers. */
export function mulDiv(a: number | bigint, num: number | bigint, den: number | bigint, mode: RoundingMode = 'floor'): number {
  const A = BigInt(a), N = BigInt(num), D = BigInt(den);
  if (D <= 0n) throw new Error('mulDiv: division by zero');
  const p = A * N;
  const q = p / D;
  const r = p % D;
  const up = mode === 'ceil' ? r > 0n : mode === 'round' ? r * 2n >= D : false;
  return Number(up ? q + 1n : q);
}

/** A percentage with up to 4 decimals as an integer: 12.3456% -> 123456. */
export const pctToScaled = (pct: number): number => Math.round(pct * 10_000);

/** EXP inside a level that corresponds to `pct` percent of the EXP needed for it (rounded to the nearest EXP). */
export function percentToExp(needed: number, pct: number): number {
  return mulDiv(needed, pctToScaled(pct), 1_000_000, 'round');
}

/** Percentage (0-100, can be more) that `exp` is of `needed`. Only for showing. */
export function expToPercent(exp: number, needed: number): number {
  return needed > 0 ? (exp / needed) * 100 : 0;
}

export interface ExpTable {
  mode: ExpTableMode;
  /** EXP needed to go from `level` to `level + 1`, or null when the table does not say. */
  needed(level: number): number | null;
  /** Sorted levels that have a value. */
  levels: number[];
}

/** Builds the lookup from the administrator's rows (inactive rows are ignored). */
export function makeExpTable(rows: ExpLevel[], mode: ExpTableMode): ExpTable {
  const value = new Map<number, number>();
  for (const r of rows) if (r.active && Number.isInteger(r.level) && Number.isFinite(r.value)) value.set(r.level, r.value);
  const needed = (level: number): number | null => {
    let n: number | null = null;
    if (mode === 'per_level') n = value.get(level) ?? null;
    else if (mode === 'cumulative_start') {
      const a = value.get(level), b = value.get(level + 1);
      n = a !== undefined && b !== undefined ? b - a : null;
    } else {
      const a = value.get(level - 1), b = value.get(level);
      n = a !== undefined && b !== undefined ? b - a : null;
    }
    return n !== null && n > 0 ? n : null;
  };
  return { mode, needed, levels: [...value.keys()].sort((a, b) => a - b) };
}

/** Level + EXP inside the level (absolute). */
export interface ExpState { level: number; exp: number }

export interface AddResult {
  state: ExpState;
  levelsGained: number;
  /** False when the table does not have a level the calculation needed: nothing past that point is invented. */
  complete: boolean;
  missingLevel?: number;
}

/**
 * Adds EXP to a character crossing as many levels as the gain pays for, each with the EXP of the level it is in.
 * overflow 'lose': the EXP above the first level-up point is thrown away.
 */
export function addExp(table: ExpTable, from: ExpState, gain: number, overflow: 'carry' | 'lose' = 'carry'): AddResult {
  let level = from.level;
  let total = from.exp + gain;
  let gained = 0;
  for (;;) {
    const need = table.needed(level);
    if (need === null) return { state: { level, exp: total }, levelsGained: gained, complete: false, missingLevel: level };
    if (total < need) return { state: { level, exp: total }, levelsGained: gained, complete: true };
    total -= need;
    level += 1;
    gained += 1;
    if (overflow === 'lose') total = 0;
  }
}

/** Absolute EXP needed to go from `from` to `to` (to must not be behind from); null when the table lacks a level in between. */
export function expBetween(table: ExpTable, from: ExpState, to: ExpState): number | null {
  if (to.level < from.level || (to.level === from.level && to.exp < from.exp)) return 0;
  let sum = -from.exp;
  for (let l = from.level; l < to.level; l++) {
    const n = table.needed(l);
    if (n === null) return null;
    sum += n;
  }
  return sum + to.exp;
}

/** Compares two positions: negative when a is behind b. */
export const comparePos = (a: ExpState, b: ExpState): number => (a.level - b.level) || (a.exp - b.exp);

/** The typed percentage of a level as absolute EXP; null when the table does not know that level (0% never needs it). */
export function pctToState(table: ExpTable, level: number, pct: number): ExpState | null {
  if (pct <= 0) return { level, exp: 0 };
  const need = table.needed(level);
  // A typed percentage never reaches 100% of the level (that would already be the next level).
  return need === null ? null : { level, exp: Math.min(percentToExp(need, pct), need - 1) };
}

/** Percentage of the current level a state is at, or null when the level is not in the table. */
export function statePct(table: ExpTable, s: ExpState): number | null {
  const need = table.needed(s.level);
  return need === null ? null : expToPercent(s.exp, need);
}

export interface TableIssue { level?: number; message: string }

/** Integrity checks for the rows of the EXP table in the chosen mode. */
export function validateExpRows(rows: ExpLevel[], mode: ExpTableMode): TableIssue[] {
  const issues: TableIssue[] = [];
  const seen = new Set<number>();
  const active = rows.filter((r) => r.active);
  for (const r of rows) {
    if (!Number.isInteger(r.level) || r.level < 1) issues.push({ level: r.level, message: 'level inválido' });
    if (!Number.isInteger(r.value) || r.value < 0) issues.push({ level: r.level, message: 'valor de EXP inválido (deve ser um inteiro não negativo)' });
    if (Number.isInteger(r.value) && r.value > Number.MAX_SAFE_INTEGER) issues.push({ level: r.level, message: 'valor grande demais' });
    if (seen.has(r.level)) issues.push({ level: r.level, message: 'level duplicado' });
    seen.add(r.level);
  }
  const sorted = [...active].sort((a, b) => a.level - b.level);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i];
    if (cur.level !== prev.level + 1) issues.push({ level: cur.level, message: `faltam os levels de ${prev.level + 1} a ${cur.level - 1}` });
    if (mode !== 'per_level' && cur.value <= prev.value) issues.push({ level: cur.level, message: 'EXP acumulada deve ser crescente' });
  }
  if (mode === 'per_level') for (const r of active) if (r.value === 0) issues.push({ level: r.level, message: 'EXP necessária igual a zero' });
  return issues;
}
