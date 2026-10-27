// Aging cost calculator: what the player spends in game. No randomness, no simulation.
import raw from './items.json';

export const MAX_AGE = 22;
/**
 * Gold of one aging attempt to level N = floor(item PRICE in its rarity x 12% x M) x N.
 * M is 5 for the first levels and 2.5 after that; the level where it drops depends on the ITEM LEVEL (goldLowUntil).
 * The per-level unit is rounded down BEFORE multiplying by N (that is how the game gets ...795 and not ...796).
 * Rarity and item type do not change the percentage (it is 12% for everything).
 *
 * Confirmed in game (item level, price in the item's rarity, value for ONE attempt):
 *   Whispering Shield, rare      lv150  3,891,888   +0 -> +1    2,335,132   M = 5
 *   Ancestor Armor, legendary    lv115  4,989,600   +0 -> +1    2,993,760   M = 5
 *   Whispering Armor, uncommon   lv150  2,594,592   +8 -> +9    14,010,795  M = 5
 *   Whispering Wand, epic        lv150  6,371,712   +10 -> +11   42,053,297  M = 5
 *   Abyss Armor, epic            lv113  3,801,600   +4 -> +5     5,702,400   M = 2.5
 *   Whispering Orb, legendary    lv150  5,739,600   +13 -> +14  24,106,320  M = 2.5
 *   Ancestor's Robe, legendary   lv115  4,989,600   +20 -> +21  31,434,480  M = 2.5
 *   Whispering Javelin, rare     lv150  4,687,200   +21 -> +22  30,935,520  M = 2.5
 *   Whispering Blade, epic       lv150  5,447,808   +21 -> +22  35,955,535  M = 2.5 (formula gives ...524: 11 gold less)
 *
 *   Dragon Shield, legendary     lv95   1,400,000   +0 -> +1    840,000     M = 5
 *
 * ESTIMATED: the switch level as a function of the item level. The data only says: lv150 is low at +11 and high at
 * +14, lv113 is already high at +5, lv115 is low at +1 and high at +21, lv95 is low at +1. We use the simplest straight
 * line that fits all of it: M = 5 up to +floor((itemLevel - 90) / 5), and always at least +1 (every +1 seen was x5).
 * Revisit with real values of items of other levels.
 */
export const GOLD_SHARE = 0.12;
export const GOLD_MULT_LOW = 5;
export const GOLD_MULT_HIGH = 2.5;
export type Rarity = 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['uncommon', 'rare', 'epic', 'legendary'];
export type Category = 'weapon' | 'armor' | 'robe' | 'shield' | 'orb';
export const CATEGORIES: Category[] = ['weapon', 'armor', 'robe', 'shield', 'orb'];

/**
 * The database shows each item's price by rarity: base (common) price x this multiplier.
 * Checked against the site on 9 items (robes, swords, shield, orb, bow, axe, boss armor).
 */
export const RARITY_PRICE_MULT: Record<Rarity, number> = { uncommon: 1, rare: 1.5, epic: 2, legendary: 2.5 };

/** Weapon groups shown in the calculator. Axes also has Tomahawk, Espadas (swords) has Blade/Claymore, Wand has Staff. */
export type WeaponGroup = 'axes' | 'swords' | 'bow' | 'dagger' | 'hammer' | 'javelin' | 'mace' | 'phantom' | 'scythe' | 'wand' | 'talon';
export const WEAPON_GROUPS: WeaponGroup[] = ['axes', 'swords', 'bow', 'dagger', 'hammer', 'javelin', 'mace', 'phantom', 'scythe', 'wand', 'talon'];

const GROUP_BY_DB_TYPE: Record<string, WeaponGroup> = {
  Axes: 'axes', Swords: 'swords', Bows: 'bow', Daggers: 'dagger', Hammers: 'hammer', Javelins: 'javelin',
  Phantoms: 'phantom', Scythes: 'scythe', Wands: 'wand', Claws: 'talon',
};
/** The database files Maces under Hammers; the calculator lists them on their own. */
export function weaponGroupOf(dbType: string | undefined, name: string): WeaponGroup | undefined {
  const g = dbType ? GROUP_BY_DB_TYPE[dbType] : undefined;
  return g === 'hammer' && /\bmace\b/i.test(name) ? 'mace' : g;
}

export interface Item { id: number; name: string; category: Category; weaponGroup?: WeaponGroup; level: number; basePrice: number; boss: boolean }

/** Every weapon, armor, robe, shield and orb of pristontale.eu/database. Items without a price are left out. */
export const ITEMS: Item[] = (raw as { id: number; n: string; c: Category; w?: string; l: number; p: number; b?: number }[])
  .filter((i) => i.p > 0)
  .map((i) => ({ id: i.id, name: i.n, category: i.c, weaponGroup: weaponGroupOf(i.w, i.n), level: i.l, basePrice: i.p, boss: !!i.b }));

/** Boss items only exist as Legendary. */
export const hasRarity = (i: Item, r: Rarity) => !i.boss || r === 'legendary';
/** Database PRICE of the item in that rarity. */
export const priceFor = (i: Item, r: Rarity) => Math.round(i.basePrice * RARITY_PRICE_MULT[r]);

export const SHELTOMS = ['Fadeo', 'Sparky', 'Raident', 'Transparo', 'Murky', 'Devine', 'Celesto', 'Mirage', 'Inferna', 'Enigma', 'Bellum', 'Oredo', 'Gemma'] as const;
export type Sheltom = (typeof SHELTOMS)[number];
export type Mats = Partial<Record<Sheltom, number>>;

/** Sheltoms needed for ONE aging attempt to each level (from the table supplied by the site owner). */
export const SHELTOMS_FOR: Record<number, Mats> = {
  1: { Fadeo: 2, Sparky: 2, Raident: 1 },
  2: { Fadeo: 2, Sparky: 2, Raident: 2 },
  3: { Fadeo: 2, Sparky: 2, Raident: 2, Transparo: 1 },
  4: { Fadeo: 2, Sparky: 2, Raident: 2, Transparo: 2 },
  5: { Fadeo: 2, Sparky: 2, Raident: 2, Transparo: 2, Murky: 1 },
  6: { Fadeo: 2, Sparky: 2, Raident: 2, Transparo: 2, Murky: 2 },
  7: { Fadeo: 2, Sparky: 2, Raident: 2, Transparo: 2, Murky: 2, Devine: 1 },
  8: { Fadeo: 2, Sparky: 2, Raident: 2, Transparo: 2, Murky: 2, Devine: 2 },
  9: { Sparky: 2, Raident: 2, Transparo: 2, Murky: 2, Devine: 2, Celesto: 1 },
  10: { Sparky: 2, Raident: 2, Transparo: 2, Murky: 2, Devine: 2, Celesto: 2 },
  11: { Raident: 2, Transparo: 2, Murky: 2, Devine: 2, Celesto: 2, Mirage: 1 },
  12: { Raident: 2, Transparo: 2, Murky: 2, Devine: 2, Celesto: 2, Mirage: 2 },
  13: { Transparo: 2, Murky: 2, Devine: 2, Celesto: 2, Mirage: 2, Inferna: 1 },
  14: { Transparo: 2, Murky: 2, Devine: 2, Celesto: 2, Mirage: 2, Inferna: 2 },
  15: { Murky: 2, Devine: 2, Celesto: 2, Mirage: 2, Inferna: 2, Enigma: 1 },
  16: { Murky: 2, Devine: 2, Celesto: 2, Mirage: 2, Inferna: 2, Enigma: 2 },
  17: { Devine: 2, Celesto: 2, Mirage: 2, Inferna: 2, Enigma: 2, Bellum: 1 },
  18: { Devine: 2, Celesto: 2, Mirage: 2, Inferna: 2, Enigma: 2, Bellum: 2 },
  19: { Celesto: 2, Mirage: 2, Inferna: 2, Enigma: 2, Bellum: 2, Oredo: 1 },
  20: { Celesto: 2, Mirage: 2, Inferna: 2, Enigma: 2, Bellum: 2, Oredo: 2 },
  21: { Mirage: 2, Inferna: 2, Enigma: 2, Bellum: 2, Oredo: 2, Gemma: 1 },
  22: { Mirage: 2, Inferna: 2, Enigma: 2, Bellum: 2, Oredo: 2, Gemma: 2 },
};

/** Last aging level that still pays GOLD_MULT_LOW for an item of this level (estimated, see above). */
export const goldLowUntil = (itemLevel: number) => Math.max(1, Math.floor((itemLevel - 90) / 5));
export const goldMult = (level: number, itemLevel: number) => (level <= goldLowUntil(itemLevel) ? GOLD_MULT_LOW : GOLD_MULT_HIGH);
export const goldForLevel = (price: number, level: number, itemLevel: number) =>
  Math.floor(price * GOLD_SHARE * goldMult(level, itemLevel) + 1e-6) * level;

export interface CostRow { level: number; attempts: number; mats: Mats; gold: number }
/** `gold` already has the event discount; `fullGold` is the price without it. */
export interface Cost { rows: CostRow[]; mats: Mats; gold: number; fullGold: number }

/**
 * Cost of aging from `from` to `to`; `attempts[level]` (default 1) multiplies that step.
 * `eventDiscount` (0-100): aging event, that % off the gold of each step (rounded down). Sheltoms are not discounted.
 */
export function agingCost(price: number, from: number, to: number, attempts: Record<number, number> = {}, eventDiscount = 0, itemLevel = 150): Cost {
  const keep = (100 - Math.min(100, Math.max(0, eventDiscount))) / 100;
  const rows: CostRow[] = [];
  const total: Mats = {};
  let gold = 0;
  let fullGold = 0;
  for (let lv = Math.max(1, from + 1); lv <= Math.min(MAX_AGE, to); lv++) {
    const n = Math.max(1, Math.floor(attempts[lv] ?? 1));
    const mats: Mats = {};
    for (const [s, q] of Object.entries(SHELTOMS_FOR[lv]) as [Sheltom, number][]) {
      mats[s] = q * n;
      total[s] = (total[s] ?? 0) + q * n;
    }
    const full = goldForLevel(price, lv, itemLevel) * n;
    const g = Math.floor(full * keep);
    fullGold += full;
    gold += g;
    rows.push({ level: lv, attempts: n, mats, gold: g });
  }
  return { rows, mats: total, gold, fullGold };
}
