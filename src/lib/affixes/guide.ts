// Rules of the Affix Guide: the level brackets (tiers), the stones, and how the list is filtered and sorted.
// Brackets and stone windows are the ones the site owner supplied; the affix data itself is in data.ts.
import { AFFIXES, type Affix, type AffixKind, type ItemType, type StatKey } from './data';

export type Tier = 1 | 2 | 3 | 4;

export const TIERS: { tier: Tier; min: number; max: number }[] = [
  { tier: 1, min: 0, max: 59 },
  { tier: 2, min: 40, max: 99 },
  { tier: 3, min: 60, max: 112 },
  { tier: 4, min: 100, max: 130 },
];

/** Stones are gated by item level; each can roll the affixes whose bracket overlaps its window. */
export const STONES: { id: 'low' | 'average' | 'great' | 'perfect'; min: number; max: number }[] = [
  { id: 'low', min: 1, max: 39 },
  { id: 'average', min: 40, max: 79 },
  { id: 'great', min: 80, max: 110 },
  { id: 'perfect', min: 111, max: 120 },
];

export const ITEM_TYPES: ItemType[] = ['amulet', 'boots', 'bracelet', 'gauntlet', 'ring'];
export const STAT_KEYS: StatKey[] = ['ATK', 'AR', 'Crit', 'Defense', 'Absorb', 'Block', 'HP', 'MP', 'HP Regen', 'MP Regen', 'Move Speed'];

export const bracket = (tier: Tier) => TIERS.find((t) => t.tier === tier)!;

/** The tiers an item of this level can roll: those whose bracket contains the level. */
export function tiersForLevel(level: number): Tier[] {
  return TIERS.filter((t) => level >= t.min && level <= t.max).map((t) => t.tier);
}

export function stoneForLevel(level: number) {
  return STONES.find((s) => level >= s.min && level <= s.max) ?? null;
}

export type SortMode = 'best' | 'tier' | 'common' | 'rare' | 'name';

export interface Query {
  item: ItemType;
  kind: 'all' | AffixKind;
  /** Item level; null = any. */
  level: number | null;
  stat: 'all' | StatKey;
  tier: 'all' | Tier;
  text: string;
}

export const statOf = (a: Affix, stat: StatKey) => a.stats.find((s) => s[0] === stat);

export function filterAffixes(q: Query, list: Affix[] = AFFIXES): Affix[] {
  const text = q.text.trim().toLowerCase();
  const allowed = q.level === null ? null : tiersForLevel(q.level);
  return list.filter((a) =>
    a.item === q.item &&
    (q.kind === 'all' || a.kind === q.kind) &&
    (q.tier === 'all' || a.tier === q.tier) &&
    (allowed === null || allowed.includes(a.tier)) &&
    (q.stat === 'all' || !!statOf(a, q.stat)) &&
    (!text || a.name.toLowerCase().includes(text)));
}

/** Biggest top value of the chosen stat first (then the bigger bottom value, then the more common one). */
export function sortAffixes(list: Affix[], mode: SortMode, stat: 'all' | StatKey): Affix[] {
  const out = [...list];
  const byName = (a: Affix, b: Affix) => a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind);
  switch (mode) {
    case 'best':
      if (stat === 'all') return sortAffixes(list, 'tier', stat);
      return out.sort((a, b) => {
        const x = statOf(a, stat)!, y = statOf(b, stat)!;
        return y[2] - x[2] || y[1] - x[1] || b.weight - a.weight || byName(a, b);
      });
    case 'tier': return out.sort((a, b) => b.tier - a.tier || a.weight - b.weight || byName(a, b));
    case 'common': return out.sort((a, b) => b.weight - a.weight || byName(a, b));
    case 'rare': return out.sort((a, b) => a.weight - b.weight || byName(a, b));
    case 'name': return out.sort(byName);
  }
}
