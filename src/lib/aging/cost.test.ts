import { describe, expect, it } from 'vitest';
import { ITEMS, SHELTOMS, WEAPON_GROUPS, weaponGroupOf, SHELTOMS_FOR, agingCost, goldForLevel, goldLowUntil, hasRarity, priceFor, type Rarity } from './cost';

const price = (name: string, r: Rarity) => priceFor(ITEMS.find((i) => i.name === name)!, r);

describe('sheltom table', () => {
  it('has all 22 levels with only known sheltoms', () => {
    for (let l = 1; l <= 22; l++) {
      expect(Object.keys(SHELTOMS_FOR[l]).every((k) => (SHELTOMS as readonly string[]).includes(k))).toBe(true);
    }
  });
  it('matches the supplied table at the edges', () => {
    expect(SHELTOMS_FOR[1]).toEqual({ Fadeo: 2, Sparky: 2, Raident: 1 });
    expect(SHELTOMS_FOR[9]).toEqual({ Sparky: 2, Raident: 2, Transparo: 2, Murky: 2, Devine: 2, Celesto: 1 });
    expect(SHELTOMS_FOR[22]).toEqual({ Mirage: 2, Inferna: 2, Enigma: 2, Bellum: 2, Oredo: 2, Gemma: 2 });
  });
});

describe('items', () => {
  const find = (n: string) => ITEMS.find((i) => i.name === n)!;
  it('has weapons, armor, robes, shields and orbs only, all with prices', () => {
    expect(ITEMS.length).toBeGreaterThan(500);
    expect(new Set(ITEMS.map((i) => i.category))).toEqual(new Set(['weapon', 'armor', 'robe', 'shield', 'orb']));
    expect(ITEMS.every((i) => i.basePrice > 0)).toBe(true);
  });
  it('prices by rarity match the database (Dark Moon: 32k / 48k / 64k / 80k)', () => {
    const dm = find('Dark Moon');
    expect(['uncommon', 'rare', 'epic', 'legendary'].map((r) => priceFor(dm, r as Rarity))).toEqual([32000, 48000, 64000, 80000]);
    expect(priceFor(find('Abyss Robe'), 'epic')).toBe(3801600);
    expect(priceFor(find('Bastard Sword'), 'legendary')).toBe(130000);
  });
  it('boss items only exist as legendary, at the price the database shows', () => {
    const deius = find('Deius Armor');
    expect(hasRarity(deius, 'epic')).toBe(false);
    expect(hasRarity(deius, 'legendary')).toBe(true);
    expect(priceFor(deius, 'legendary')).toBe(6486480);
  });
});

describe('weapon groups and Whispering level', () => {
  const names = (g: string) => ITEMS.filter((i) => i.weaponGroup === g).map((i) => i.name);
  it('every weapon belongs to one of the eleven groups', () => {
    const weapons = ITEMS.filter((i) => i.category === 'weapon');
    expect(weapons.every((i) => i.weaponGroup && WEAPON_GROUPS.includes(i.weaponGroup))).toBe(true);
    expect(new Set(weapons.map((i) => i.weaponGroup)).size).toBe(11);
  });
  it('puts Tomahawk with Axes, Blade/Claymore with swords, Staff with Wand, Claw with Talon, Mace on its own', () => {
    expect(names('axes')).toContain('Whispering TomaHawk');
    expect(names('swords')).toEqual(expect.arrayContaining(['Whispering Blade', 'Whispering Claymore']));
    expect(names('wand')).toEqual(expect.arrayContaining(['Whispering Wand', 'Whispering Staff']));
    expect(names('talon')).toContain('Whispering Talon');
    expect(names('mace')).toContain('Whispering Mace');
    expect(names('hammer')).not.toContain('Whispering Mace');
    expect(weaponGroupOf('Hammers', 'Mace')).toBe('mace');
    expect(weaponGroupOf('Hammers', 'Maul')).toBe('hammer');
  });
  it('Whispering items are level 150', () => {
    const w = ITEMS.filter((i) => i.name.startsWith('Whispering'));
    expect(w.length).toBeGreaterThan(10);
    expect(w.every((i) => i.level === 150)).toBe(true);
  });
});

describe('gold per aging: real in-game values', () => {
  it.each([
    ['Whispering Shield', 'rare', 1, 2335132],
    ["Ancestor's Armor", 'legendary', 1, 2993760],
    ['Whispering Armor', 'uncommon', 9, 14010795],
    ['Whispering Wand', 'epic', 11, 42053297],
    ['Abyss Armor', 'epic', 5, 5702400],
    ['Dragon Shield', 'legendary', 1, 840000],
    ['Whispering Orb', 'legendary', 14, 24106320],
    ["Ancestor's Robe", 'legendary', 21, 31434480],
    ['Whispering Javelin', 'rare', 22, 30935520],
  ] as [string, Rarity, number, number][])('%s (%s) +%i = %i', (name, r, level, real) => {
    expect(goldForLevel(price(name, r), level, ITEMS.find((i) => i.name === name)!.level)).toBe(real);
  });
  it('Whispering Blade (epic) +22 is within 11 gold of the real 35,955,535', () => {
    const calc = goldForLevel(price('Whispering Blade', 'epic'), 22, 150);
    expect(calc).toBe(35955524);
    expect(Math.abs(calc - 35955535)).toBeLessThanOrEqual(11);
  });
  it('is x5 per level up to a switch level that grows with the item level, x2.5 after', () => {
    expect(goldForLevel(1000000, 1, 150)).toBe(600000);
    expect(goldForLevel(1000000, 11, 150)).toBe(6600000);
    expect(goldForLevel(1000000, 14, 150)).toBe(4200000);
    expect(goldForLevel(1000000, 3, 113)).toBe(1800000);
    expect(goldForLevel(1000000, 5, 113)).toBe(1500000);
  });
  it('switch level: +4 for lv113, +5 for lv115, +12 for lv150, +1 for lv95 and lower', () => {
    expect([113, 115, 150, 100, 95, 60].map(goldLowUntil)).toEqual([4, 5, 12, 2, 1, 1]);
  });
});

describe('agingCost', () => {
  it('sums sheltoms and gold over the steps', () => {
    const c = agingCost(1000, 0, 2);
    expect(c.rows).toHaveLength(2);
    expect(c.mats).toEqual({ Fadeo: 4, Sparky: 4, Raident: 3 });
    expect(c.gold).toBe(goldForLevel(1000, 1, 150) + goldForLevel(1000, 2, 150));
  });
  it('applies an aging-event discount to the gold only', () => {
    const full = agingCost(1000000, 0, 2);
    const half = agingCost(1000000, 0, 2, {}, 50);
    expect(half.gold).toBe(Math.floor(full.gold / 2));
    expect(half.fullGold).toBe(full.gold);
    expect(half.mats).toEqual(full.mats);
    expect(agingCost(1000000, 0, 2, {}, 0).gold).toBe(full.gold);
    expect(agingCost(1000000, 0, 2, {}, 100).gold).toBe(0);
    expect(agingCost(1000000, 0, 2, {}, 150).gold).toBe(0);
  });
  it('multiplies a step by its attempts and ignores levels outside 1..22', () => {
    const c = agingCost(1000, 21, 30, { 22: 3 });
    expect(c.rows.map((r) => r.level)).toEqual([22]);
    expect(c.mats.Gemma).toBe(6);
    expect(c.gold).toBe(3 * goldForLevel(1000, 22, 150));
    expect(agingCost(1000, 5, 5).rows).toHaveLength(0);
  });
});
