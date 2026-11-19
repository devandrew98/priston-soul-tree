// Talks to the database for /balance. The table is closed: everything goes through the functions of supabase/46_balance.sql.
import { supabase } from './market/supabase';
import type { BalanceChange, BalanceTest } from './balance';
import { isClassSlug } from './skilltree/classes';
import type { ClassSlug } from './skilltree/types';

interface Row {
  id: string; class: string; mobs: number; seconds: number; tester: string; level: number | null;
  place: string; notes: string; tested_on: string; created_at: string; mode: string | null; patch: string | null;
}

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }

const toTest = (r: Row): BalanceTest | null => isClassSlug(r.class)
  ? { id: r.id, cls: r.class, mobs: r.mobs, seconds: r.seconds, tester: r.tester, level: r.level, place: r.place, notes: r.notes, patch: r.patch ?? '', testedOn: r.tested_on, createdAt: r.created_at, mode: r.mode === 'aoe' || r.mode === 'single' ? r.mode : null }
  : null;

export async function fetchBalance(): Promise<BalanceTest[]> {
  const { data, error } = await sb().rpc('balance_list');
  if (error) throw error;
  return (data as Row[]).map(toTest).filter((t): t is BalanceTest => t !== null);
}

export type BalanceInput = Omit<BalanceTest, 'id' | 'createdAt'>;

/** `id` null = a new test; otherwise changes that test. */
export async function saveBalance(id: string | null, t: BalanceInput): Promise<void> {
  const { error } = await sb().rpc('balance_save', {
    p_id: id, p_class: t.cls, p_mobs: t.mobs, p_seconds: t.seconds, p_tester: t.tester,
    p_level: t.level, p_place: t.place, p_notes: t.notes, p_on: t.testedOn, p_mode: t.mode, p_patch: t.patch,
  });
  if (error) throw error;
}

interface ChangeRow { id: string; class: string | null; changed_on: string; patch: string; note: string }

/** Game changes (supabase/52_balance_changes.sql): one class, or everything when `cls` is null. */
export async function fetchChanges(): Promise<BalanceChange[]> {
  const { data, error } = await sb().rpc('balance_changes_list');
  if (error) throw error;
  return (data as ChangeRow[])
    .filter((r) => r.class === null || isClassSlug(r.class))
    .map((r) => ({ id: r.id, cls: r.class === null ? null : (r.class as ClassSlug), on: r.changed_on, patch: r.patch, note: r.note }));
}

export async function addChange(c: Omit<BalanceChange, 'id'>): Promise<void> {
  const { error } = await sb().rpc('balance_change_add', { p_class: c.cls, p_on: c.on, p_patch: c.patch, p_note: c.note });
  if (error) throw error;
}

export async function deleteChange(id: string): Promise<void> {
  const { error } = await sb().rpc('balance_change_delete', { p_id: id });
  if (error) throw error;
}

export async function deleteBalance(id: string): Promise<void> {
  const { error } = await sb().rpc('balance_delete', { p_id: id });
  if (error) throw error;
}
