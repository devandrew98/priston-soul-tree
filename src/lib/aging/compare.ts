// Item comparison: the "perfect" version (best roll of every stat) of a weapon, armor or robe in a given rarity.
// The rarity bonus is added the way pristontale.eu/database does it: a flat amount per item-level band times (rarity - 1).
// Orbs and shields are not compared (their data on the site is wrong).
import raw from './compare-items.json';
import { applyAging, MAX_AGE, type StatKey as AgeKey, type StatResult } from './bonuses';
import { weaponGroupOf, type Rarity, type WeaponGroup } from './cost';

export { MAX_AGE };

export type CompareCategory = 'weapon' | 'armor' | 'robe';
export const COMPARE_CATEGORIES: CompareCategory[] = ['weapon', 'armor', 'robe'];

/** Common = 0 bonus steps. The Age system works with the four rarities above Common, so the comparison does too. */
export const RARITY_STEPS: Record<Rarity, number> = { uncommon: 1, rare: 2, epic: 3, legendary: 4 };

export interface CompareItem {
  id: number;
  name: string;
  category: CompareCategory;
  weaponGroup?: WeaponGroup;
  /** Level shown in the Age system (fusion level when the item has one). */
  level: number;
  /** Required level: it is the one that picks the rarity bonus band. */
  reqLevel: number;
  boss: boolean;
  /** Weapon: minimum damage (highest), maximum damage (highest), critical, attack rating (highest). */
  dmin?: number;
  dmax?: number;
  crit?: number;
  atr?: number;
  /** Armor and robe: defense (highest) and absorption (highest). */
  def?: number;
  abs?: number;
}

type Raw = { id: number; n: string; c: CompareCategory; t: string; l: number; f: number; b: number; dmin?: number; dmax?: number; crit?: number; atr?: number; def?: number; abs?: number };

export const COMPARE_ITEMS: CompareItem[] = (raw as Raw[]).map((r) => ({
  id: r.id, name: r.n, category: r.c, weaponGroup: r.c === 'weapon' ? weaponGroupOf(r.t, r.n) : undefined,
  level: r.f || r.l, reqLevel: r.l, boss: !!r.b, dmin: r.dmin, dmax: r.dmax, crit: r.crit, atr: r.atr, def: r.def, abs: r.abs,
}));

/** Boss items only exist as Legendary (same rule as the Age system). */
export const compareHasRarity = (i: CompareItem, r: Rarity) => !i.boss || r === 'legendary';

interface WeaponBand { damage: number; atr: number; crit: number }
/** Levels that are not listed get no rarity bonus (the site does the same). */
function weaponBand(level: number): WeaponBand | null {
  if (level >= 0 && level <= 102) return { damage: 3, atr: 30, crit: 1 };
  if (level >= 103 && level <= 112) return { damage: 4, atr: 30, crit: 1 };
  if (level === 113) return { damage: 5, atr: 30, crit: 1 };
  if (level === 115) return { damage: 8, atr: 30, crit: 1 };
  if (level === 118) return { damage: 10, atr: 30, crit: 1 };
  if (level === 120) return { damage: 12, atr: 40, crit: 1 };
  return null;
}

interface ArmorBand { abs: number; def: number }
function armorBand(level: number, robe: boolean): ArmorBand | null {
  if (level >= 0 && level <= 18) return { abs: 1, def: 40 };
  if (level >= 20 && level <= 38) return { abs: 2, def: 40 };
  if (level >= 40 && level <= 98) return { abs: robe ? 3.4 : 4.3, def: 40 };
  if (level >= 100 && level <= 113) return { abs: robe ? 7.4 : 8.6, def: 40 };
  if (level >= 115 && level <= 120) return { abs: robe ? 14.8 : 17.2, def: 80 };
  return null;
}

/** Removes the floating point noise (366.79999 + 51.6) and keeps two decimals like the site. */
const clean = (n: number) => Math.round(n * 100) / 100;

export type WeaponStats = { dmin: number; dmax: number; crit: number; atr: number };
export type DefenseStats = { def: number; abs: number };

/** Value of each stat after aging from +0 to +age (the rows of applyAging, by key). */
const agedValues = (res: StatResult): Partial<Record<AgeKey, number>> => (res.ok ? Object.fromEntries(res.rows.map((r) => [r.key, r.after])) : {});

export function weaponStats(item: CompareItem, rarity: Rarity, age = 0): WeaponStats {
  const steps = RARITY_STEPS[rarity];
  const band = weaponBand(item.reqLevel);
  const k = band ? steps : 0;
  const perfect = {
    dmin: clean((item.dmin ?? 0) + (band?.damage ?? 0) * k),
    dmax: clean((item.dmax ?? 0) + (band?.damage ?? 0) * k),
    crit: clean((item.crit ?? 0) + (band?.crit ?? 0) * k),
    atr: clean((item.atr ?? 0) + (band?.atr ?? 0) * k),
  };
  if (age <= 0) return perfect;
  const v = agedValues(applyAging('weapon', item.level, { min: perfect.dmin, max: perfect.dmax, rating: perfect.atr, crit: perfect.crit }, 0, age));
  return { dmin: v.min ?? perfect.dmin, dmax: v.max ?? perfect.dmax, crit: v.crit ?? perfect.crit, atr: v.rating ?? perfect.atr };
}

export function defenseStats(item: CompareItem, rarity: Rarity, age = 0): DefenseStats {
  const steps = RARITY_STEPS[rarity];
  const band = armorBand(item.reqLevel, item.category === 'robe');
  const k = band ? steps : 0;
  const perfect = { def: clean((item.def ?? 0) + (band?.def ?? 0) * k), abs: clean((item.abs ?? 0) + (band?.abs ?? 0) * k) };
  if (age <= 0) return perfect;
  // Robes use the armor table. The item is perfect, so there is no shortfall to carry over.
  const v = agedValues(applyAging('armor', item.level, { def: perfect.def, absorb: perfect.abs }, 0, age));
  return { def: v.def ?? perfect.def, abs: v.absorb ?? perfect.abs };
}

export type StatKey = keyof WeaponStats | keyof DefenseStats;
export const STAT_KEYS: Record<CompareCategory, StatKey[]> = {
  weapon: ['dmin', 'dmax', 'crit', 'atr'],
  armor: ['def', 'abs'],
  robe: ['def', 'abs'],
};

/** Stats of an item in a rarity, by key. */
export function statsOf(item: CompareItem, rarity: Rarity, age = 0): Partial<Record<StatKey, number>> {
  return item.category === 'weapon' ? weaponStats(item, rarity, age) : defenseStats(item, rarity, age);
}

export interface CompareRow { key: StatKey; a: number; b: number; diff: number; better: 'a' | 'b' | null }

/** One row per stat (each side with its own aging): both values, the difference (a - b) and who is ahead (null when tied). */
export function compareItems(a: { item: CompareItem; rarity: Rarity; age?: number }, b: { item: CompareItem; rarity: Rarity; age?: number }): CompareRow[] {
  const sa = statsOf(a.item, a.rarity, a.age ?? 0);
  const sb = statsOf(b.item, b.rarity, b.age ?? 0);
  return STAT_KEYS[a.item.category].map((key) => {
    const x = sa[key] ?? 0;
    const y = sb[key] ?? 0;
    const diff = clean(x - y);
    return { key, a: x, b: y, diff, better: diff > 0 ? 'a' : diff < 0 ? 'b' : null };
  });
}
