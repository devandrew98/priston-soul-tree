// Reputation tiers (categories) — editable in the admin panel and stored in the
// DB, with the static defaults as a fallback. `repTier(seller)` resolves a
// seller's category: a manual override wins, otherwise it's the highest tier the
// seller's itemsSold reaches.
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { REP_TIERS } from './data';
import type { RepLevel, Seller } from './types';

export interface RepTierDef {
  key: string;
  label: string;
  base: RepLevel; // visual "type": bronze / silver / gold / diamond / legendary
  icon: string;
  color: string;
  min: number; // min itemsSold to reach (automatic mode)
  sort: number;
}

// Defaults mirror the seed in supabase/09_rep_tiers.sql.
export const DEFAULT_TIERS: RepTierDef[] = REP_TIERS.map((tRow, i) => ({
  key: tRow.id, label: tRow.label, base: tRow.id, icon: tRow.icon, color: tRow.color, min: tRow.min, sort: i,
}));

// Visual presets used when the admin picks a base "type".
export const BASE_PRESETS: Record<RepLevel, { icon: string; color: string }> = {
  bronze: { icon: '🥉', color: '#cd7f32' },
  silver: { icon: '🥈', color: '#c0c0c0' },
  gold: { icon: '🥇', color: '#e6b93b' },
  diamond: { icon: '💎', color: '#5ad6d0' },
  legendary: { icon: '👑', color: '#e0663b' },
};

// ---- external store (so RepBadge re-renders when tiers change) ---------------
let _tiers: RepTierDef[] = [...DEFAULT_TIERS];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function currentTiers(): RepTierDef[] { return _tiers; }
export function setTiers(list: RepTierDef[]) {
  _tiers = [...list].sort((a, b) => a.sort - b.sort || a.min - b.min);
  emit();
}
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

/** Subscribe a component to the tiers list (re-renders on edits). */
export function useRepTiers(): RepTierDef[] {
  return useSyncExternalStore(subscribe, currentTiers, currentTiers);
}

/** Resolve a seller's tier: manual override first, else highest reached by sales. */
export function pickTier(seller: Pick<Seller, 'itemsSold' | 'repTierOverride'>): RepTierDef {
  const tiers = _tiers.length ? _tiers : DEFAULT_TIERS;
  if (seller.repTierOverride) {
    const forced = tiers.find((t) => t.key === seller.repTierOverride);
    if (forced) return forced;
  }
  const byMin = [...tiers].sort((a, b) => a.min - b.min);
  return [...byMin].reverse().find((t) => seller.itemsSold >= t.min) ?? byMin[0] ?? DEFAULT_TIERS[0];
}

/** Back-compat alias used across the app. */
export const repTier = pickTier;

// ---- DB layer ---------------------------------------------------------------
function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }
interface Row { key: string; label: string; base: RepLevel; icon: string; color: string; min_sold: number; sort: number }
const rowToDef = (r: Row): RepTierDef => ({ key: r.key, label: r.label, base: r.base, icon: r.icon, color: r.color, min: r.min_sold, sort: r.sort });

export async function fetchRepTiers(): Promise<RepTierDef[]> {
  const { data, error } = await sb().from('rep_tiers').select('*').order('sort', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(rowToDef);
}

/** Fetch + publish to the store (falls back to defaults on error). */
export async function loadRepTiers(): Promise<void> {
  try {
    const list = await fetchRepTiers();
    if (list.length) setTiers(list);
  } catch { /* keep defaults */ }
}

export async function saveTier(def: RepTierDef): Promise<void> {
  const { error } = await sb().from('rep_tiers').upsert({
    key: def.key, label: def.label, base: def.base, icon: def.icon, color: def.color, min_sold: def.min, sort: def.sort,
  });
  if (error) throw error;
}

export async function deleteTier(key: string): Promise<void> {
  const { error } = await sb().from('rep_tiers').delete().eq('key', key);
  if (error) throw error;
}

/** Assign (or clear, with null) a member's manual category. */
export async function setMemberTier(userId: string, key: string | null): Promise<void> {
  const { error } = await sb().from('profiles').update({ rep_tier_override: key }).eq('id', userId);
  if (error) throw error;
}

export function newTierKey(): string {
  return 'tier_' + Math.random().toString(36).slice(2, 9);
}
