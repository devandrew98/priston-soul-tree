// Stat bonuses of aging, from the tables supplied by the site owner (same numbers as the official wiki).
// The player types the stats of his item as they are NOW; we add what the levels between the current and the desired aging give.
// Same rules as the aging code of the official database (pristontale.eu/database): the defense percent is applied level after level
// and rounded to an integer at each level; every other bonus is added. Items of level 103 or more all use the last row.
export const MAX_AGE = 22;

export type StatType = 'weapon' | 'armor' | 'shield' | 'orb';
export const STAT_TYPES: StatType[] = ['weapon', 'armor', 'shield', 'orb'];
export type StatKey = 'min' | 'max' | 'rating' | 'crit' | 'def' | 'absorb' | 'block';

/** Which fields the player fills for each item type. */
export const STAT_KEYS: Record<StatType, StatKey[]> = {
  weapon: ['min', 'max', 'rating', 'crit'],
  armor: ['def', 'absorb'],
  shield: ['def', 'absorb', 'block'],
  orb: ['def', 'absorb', 'block'],
};
/** Armor (and robe: same table), shield and orb tables depend on the item level. */
export const usesItemLevel = (t: StatType) => t !== 'weapon';

// Gain per level, by band: +1..+9, +10..+19, +20..+22.
const bandOf = (level: number) => (level <= 9 ? 0 : level <= 19 ? 1 : 2);
/**
 * Weapon gain per level, by band (the table supplied by the site owner). Confirmed in game with a Whispering Staff:
 * 234-246 damage, 28% crit, 1394 rating at +0 -> 272-284, 39% crit, 1774 rating at +22 (+38, +11%, +380).
 * Critical chance is the exception: the table shows 0.5 / 0.5 / 1, but the real total is +11%, which is +1% every
 * other level (on each even level: aging from an odd level), as the wiki says. Estimated for partial agings.
 */
const WEAPON = { atk: [1, 2, 3], rating: [10, 20, 30] } as const;

/** Item level ranges of the tables (the database uses the 103+ row for every higher level too). */
export const LEVEL_RANGES = [[0, 39], [40, 79], [80, 102], [103, Number.POSITIVE_INFINITY]] as const;
const rangeOf = (itemLevel: number) => LEVEL_RANGES.findIndex(([a, b]) => itemLevel >= a && itemLevel <= b);

const ARMOR = {
  def: [[1, 2, 3], [1.5, 2.5, 3.5], [2, 3, 4], [2.5, 3.5, 4.5]],
  absorb: [[1, 2, 4], [2, 4, 5], [3, 5, 7], [4, 8, 10]],
} as const;
const SHIELD = {
  def: [3, 3.5, 4],
  absorb: [[0.5, 1.0, 1.5], [0.6, 1.2, 1.8], [0.7, 1.4, 2.1], [0.8, 1.6, 2.4]],
  block: 0.5,
} as const;

/**
 * `defPerfect` (optional) is the highest defense this item can have (a perfect roll). The aging percent is applied to the
 * PERFECT value and the shortfall of the player's item stays fixed afterwards: confirmed in game with a Whispering Robe
 * (epic) of 1564 defense, perfect 1600: 1600 aged to +22 is 3217, minus the 36 missing = 3181, the real value.
 */
export type Stats = Partial<Record<StatKey, number>> & { defPerfect?: number };
export interface StatRow { key: StatKey; before: number; after: number }
export type StatResult = { ok: true; rows: StatRow[]; levels: number } | { ok: false; reason: 'range' };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Stats of the item after aging from `from` to `to` (gains of the levels from+1 .. to). */
export function applyAging(type: StatType, itemLevel: number, stats: Stats, from: number, to: number): StatResult {
  const levels: number[] = [];
  for (let l = Math.max(1, from + 1); l <= Math.min(MAX_AGE, to); l++) levels.push(l);

  let ri = 0;
  if (usesItemLevel(type)) {
    ri = rangeOf(itemLevel);
    if (ri < 0) return { ok: false, reason: 'range' };
  }
  const sum = (per: readonly number[]) => levels.reduce((a, l) => a + per[bandOf(l)], 0);
  const compound = (cur: number, pct: readonly number[]) => levels.reduce((v, l) => Math.round(v + v / (100 / pct[bandOf(l)])), cur);

  const rows: StatRow[] = STAT_KEYS[type].map((key) => {
    const before = stats[key] ?? 0;
    let after = before;
    if (key === 'min' || key === 'max') after = before + sum(WEAPON.atk);
    else if (key === 'rating') after = before + sum(WEAPON.rating);
    else if (key === 'crit') after = before + levels.filter((l) => l % 2 === 0).length;
    else if (key === 'def') {
      const perfect = stats.defPerfect && stats.defPerfect > before ? stats.defPerfect : before;
      after = compound(perfect, type === 'armor' ? ARMOR.def[ri] : SHIELD.def) - (perfect - before);
    }
    else if (key === 'absorb') after = before + sum(type === 'armor' ? ARMOR.absorb[ri] : SHIELD.absorb[ri]);
    else if (key === 'block') after = before + levels.length * SHIELD.block;
    return { key, before, after: r2(after) };
  });
  return { ok: true, rows, levels: levels.length };
}
