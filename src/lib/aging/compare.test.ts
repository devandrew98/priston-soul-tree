import { describe, expect, it } from 'vitest';
import { COMPARE_ITEMS, compareHasRarity, compareItems, defenseStats, weaponStats } from './compare';

const byName = (n: string) => {
  const i = COMPARE_ITEMS.find((x) => x.name === n);
  if (!i) throw new Error(n);
  return i;
};

describe('perfect item stats by rarity (values checked on pristontale.eu/database)', () => {
  it('Whispering Blade, epic: damage 204-210, critical 26, attack rating 1420', () => {
    expect(weaponStats(byName('Whispering Blade'), 'epic')).toEqual({ dmin: 204, dmax: 210, crit: 26, atr: 1420 });
  });
  it('Whispering Armor, epic: defense 1600, absorption 418.4', () => {
    expect(defenseStats(byName('Whispering Armor'), 'epic')).toEqual({ def: 1600, abs: 418.4 });
  });
  it('robes use their own absorption bonus', () => {
    // 301.2 + 14.8 x 3 = 345.6, defense 1360 + 80 x 3
    expect(defenseStats(byName('Whispering Robe'), 'epic')).toEqual({ def: 1600, abs: 345.6 });
  });
  it('uncommon is one bonus step, legendary is four', () => {
    const blade = byName('Whispering Blade');
    expect(weaponStats(blade, 'uncommon').dmax).toBe(174 + 12);
    expect(weaponStats(blade, 'legendary').dmax).toBe(174 + 48);
  });
});

describe('with aging (+0 to +N applied over the perfect item)', () => {
  it('+0 changes nothing', () => {
    const blade = byName('Whispering Blade');
    expect(weaponStats(blade, 'epic', 0)).toEqual(weaponStats(blade, 'epic'));
  });
  it('weapon +22: +38 damage, +380 rating, +11 critical (confirmed in game)', () => {
    expect(weaponStats(byName('Whispering Blade'), 'epic', 22)).toEqual({ dmin: 242, dmax: 248, crit: 37, atr: 1800 });
  });
  it('Whispering Robe epic +22: defense 3217 (confirmed in game, perfect item)', () => {
    expect(defenseStats(byName('Whispering Robe'), 'epic', 22).def).toBe(3217);
  });
  it('compares each side with its own aging', () => {
    const blade = byName('Whispering Blade');
    const rows = compareItems({ item: blade, rarity: 'epic', age: 10 }, { item: blade, rarity: 'epic', age: 0 });
    expect(rows[0]).toMatchObject({ a: 204 + 9 + 2, b: 204, better: 'a' });
  });
});

describe('items', () => {
  it('only has weapons, armors and robes (no orb or shield)', () => {
    expect(COMPARE_ITEMS.every((i) => ['weapon', 'armor', 'robe'].includes(i.category))).toBe(true);
    // "Shield Sword" and "Shield Phantom" are real weapons that just have the word in their name
    expect(COMPARE_ITEMS.some((i) => ['Whispering Shield', 'Whispering Orb'].includes(i.name))).toBe(false);
    expect(COMPARE_ITEMS.length).toBeGreaterThan(500);
  });
  it('boss items only exist as legendary', () => {
    const boss = byName('Deius Armor');
    expect(compareHasRarity(boss, 'epic')).toBe(false);
    expect(compareHasRarity(boss, 'legendary')).toBe(true);
    expect(compareHasRarity(byName('Whispering Armor'), 'epic')).toBe(true);
  });
});

describe('compareItems', () => {
  it('shows the difference and who is ahead', () => {
    const rows = compareItems({ item: byName('Whispering Armor'), rarity: 'epic' }, { item: byName('Whispering Robe'), rarity: 'epic' });
    expect(rows).toEqual([
      { key: 'def', a: 1600, b: 1600, diff: 0, better: null },
      { key: 'abs', a: 418.4, b: 345.6, diff: 72.8, better: 'a' },
    ]);
  });
  it('the same item in two rarities', () => {
    const blade = byName('Whispering Blade');
    const rows = compareItems({ item: blade, rarity: 'rare' }, { item: blade, rarity: 'legendary' });
    expect(rows.map((r) => r.better)).toEqual(['b', 'b', 'b', 'b']);
    expect(rows[0]).toMatchObject({ a: 192, b: 216, diff: -24 });
  });
});
