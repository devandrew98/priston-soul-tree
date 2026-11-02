// Rules of the Souls catalog (/lista-souls): joins the Soul Tree's souls with where they drop, then filters and sorts.
import { SOULS } from './souls';
import { SOUL_WHERE } from './soulLocations';
import type { Category, Rarity, Soul } from './types';

export interface CatalogSoul {
  soul: Soul;
  /** Soul level: the tree's own, or the one in the sheet when the tree has none. */
  level: number;
  where: ([string] | [string, number])[];
}

// The tree has no icon file name for this soul, but the image is in /fusion (only the _d version exists).
const ICON_FALLBACK: Record<string, string> = { 'vault-knight': '/fusion/VaultKnightSoul_d.png' };

export const CATALOG: CatalogSoul[] = SOULS.map((soul0) => {
  const soul = !soul0.img && ICON_FALLBACK[soul0.id] ? { ...soul0, img: ICON_FALLBACK[soul0.id] } : soul0;
  const w = SOUL_WHERE[soul.id];
  return { soul, level: soul.mapLevel ?? w?.level ?? 0, where: w?.where ?? [] };
});

/** "Todos os mapas ..." is a rule, not a place to filter by. */
const isRule = (map: string) => /^todos os mapas/i.test(map);

export const MAPS: string[] = [...new Set(CATALOG.flatMap((c) => c.where.map((w) => w[0])).filter((m) => !isRule(m)))]
  .sort((a, b) => a.localeCompare(b));

export const STAT_LABELS: string[] = [...new Set(SOULS.flatMap((s) => s.stats.map((st) => st.statLabel)))]
  .sort((a, b) => a.localeCompare(b));

export type SortMode = 'level' | 'levelDesc' | 'name' | 'stat' | 'rarity';

export interface Query {
  category: 'all' | Category;
  text: string;
  stat: 'all' | string;
  map: 'all' | string;
  rarity: 'all' | Rarity;
}

export const EMPTY_QUERY: Query = { category: 'all', text: '', stat: 'all', map: 'all', rarity: 'all' };

const RARITY_ORDER: Record<Rarity, number> = { common: 0, rare: 1, legendary: 2 };

export function filterCatalog(q: Query, list: CatalogSoul[] = CATALOG): CatalogSoul[] {
  const text = q.text.trim().toLowerCase();
  return list.filter((c) =>
    (q.category === 'all' || c.soul.category === q.category) &&
    (q.rarity === 'all' || c.soul.rarity === q.rarity) &&
    (q.stat === 'all' || c.soul.stats.some((st) => st.statLabel === q.stat)) &&
    (q.map === 'all' || c.where.some((w) => w[0] === q.map)) &&
    (!text || [c.soul.name, ...c.soul.stats.map((st) => st.statLabel), ...c.where.map((w) => w[0])].some((t) => t.toLowerCase().includes(text))));
}

/** With a stat chosen, "stat" puts the biggest top-rank value of that stat first. */
export function sortCatalog(list: CatalogSoul[], mode: SortMode, stat: 'all' | string): CatalogSoul[] {
  const out = [...list];
  const byName = (a: CatalogSoul, b: CatalogSoul) => a.soul.name.localeCompare(b.soul.name);
  const top = (c: CatalogSoul) => c.soul.stats.find((st) => st.statLabel === stat)?.ranks[2] ?? 0;
  switch (mode) {
    case 'level': return out.sort((a, b) => a.level - b.level || byName(a, b));
    case 'levelDesc': return out.sort((a, b) => b.level - a.level || byName(a, b));
    case 'name': return out.sort(byName);
    case 'rarity': return out.sort((a, b) => RARITY_ORDER[b.soul.rarity] - RARITY_ORDER[a.soul.rarity] || a.level - b.level || byName(a, b));
    case 'stat': return stat === 'all' ? sortCatalog(list, 'level', stat) : out.sort((a, b) => top(b) - top(a) || a.level - b.level || byName(a, b));
  }
}

/** 1 → "1", 0.25 → "0.25", never "1.00". */
export function plain(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
