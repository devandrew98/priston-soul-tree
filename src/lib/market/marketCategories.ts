// Marketplace item categories (Armas, Armaduras, ...) — editable in the admin
// panel and stored in the DB, with the static defaults as a fallback.
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { CATEGORIES } from './data';
import type { Lang } from '../i18n';

export interface MarketCategory {
  key: string;
  icon: string;
  label: { pt: string; en: string };
  subs: string[];
  sort: number;
}

// Default labels mirror the seed in supabase/12_market_categories.sql.
const DEFAULT_LABELS: Record<string, { pt: string; en: string }> = {
  weapons: { pt: 'Armas', en: 'Weapons' },
  armors: { pt: 'Armaduras', en: 'Armors' },
  jewels: { pt: 'Jóias', en: 'Jewelry' },
  sheltoms: { pt: 'Sheltoms', en: 'Sheltoms' },
  souls: { pt: 'Souls', en: 'Souls' },
  pets: { pt: 'Pets', en: 'Pets' },
  premium: { pt: 'Premiums', en: 'Premiums' },
};

export const DEFAULT_CATEGORIES: MarketCategory[] = CATEGORIES.map((c, i) => ({
  key: c.id, icon: c.icon, label: DEFAULT_LABELS[c.id] ?? { pt: c.id, en: c.id }, subs: c.subs, sort: i,
}));

// ---- external store ---------------------------------------------------------
let _cats: MarketCategory[] = [...DEFAULT_CATEGORIES];
const listeners = new Set<() => void>();

export function currentCategories(): MarketCategory[] { return _cats; }
export function setCategories(list: MarketCategory[]) {
  _cats = [...list].sort((a, b) => a.sort - b.sort);
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

/** Subscribe a component to the categories list (re-renders on edits). */
export function useCategories(): MarketCategory[] {
  return useSyncExternalStore(subscribe, currentCategories, currentCategories);
}

export function categoryLabel(key: string, lang: Lang): string {
  return _cats.find((c) => c.key === key)?.label[lang] ?? key;
}
export function categoryIcon(key: string): string {
  return _cats.find((c) => c.key === key)?.icon ?? '📦';
}

// ---- DB layer ---------------------------------------------------------------
function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }
interface Row { key: string; icon: string; label_pt: string; label_en: string; subs: string[]; sort: number }
const toCat = (r: Row): MarketCategory => ({ key: r.key, icon: r.icon, label: { pt: r.label_pt, en: r.label_en }, subs: r.subs ?? [], sort: r.sort });

export async function fetchCategories(): Promise<MarketCategory[]> {
  const { data, error } = await sb().from('market_categories').select('*').order('sort', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(toCat);
}

/** Fetch + publish to the store (keeps defaults on error). */
export async function loadCategories(): Promise<void> {
  try {
    const list = await fetchCategories();
    if (list.length) setCategories(list);
  } catch { /* keep defaults */ }
}

export async function saveCategory(cat: MarketCategory): Promise<void> {
  const { error } = await sb().from('market_categories').upsert({
    key: cat.key, icon: cat.icon, label_pt: cat.label.pt, label_en: cat.label.en, subs: cat.subs, sort: cat.sort,
  });
  if (error) throw error;
}

export async function deleteCategory(key: string): Promise<void> {
  const { error } = await sb().from('market_categories').delete().eq('key', key);
  if (error) throw error;
}

export function newCategoryKey(): string {
  return 'cat_' + Math.random().toString(36).slice(2, 9);
}
