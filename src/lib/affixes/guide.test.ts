import { describe, expect, it } from 'vitest';
import { AFFIXES } from './data';
import { filterAffixes, sortAffixes, statOf, stoneForLevel, tiersForLevel, type Query } from './guide';

const base: Query = { item: 'ring', kind: 'all', level: null, stat: 'all', tier: 'all', text: '' };

describe('data', () => {
  it('has every row valid', () => {
    expect(AFFIXES.length).toBe(370);
    for (const a of AFFIXES) {
      expect(a.stats.length).toBeGreaterThan(0);
      for (const [, min, max] of a.stats) expect(min).toBeLessThanOrEqual(max);
      expect(a.rarity[0]).toBeLessThanOrEqual(a.rarity[1]);
      expect(a.weight).toBeGreaterThan(0);
    }
  });
});

describe('levels', () => {
  it('maps an item level to the tiers whose bracket contains it', () => {
    expect(tiersForLevel(30)).toEqual([1]);
    expect(tiersForLevel(50)).toEqual([1, 2]);
    expect(tiersForLevel(105)).toEqual([3, 4]);
    expect(tiersForLevel(120)).toEqual([4]);
  });
  it('picks the stone by item level', () => {
    expect(stoneForLevel(20)?.id).toBe('low');
    expect(stoneForLevel(79)?.id).toBe('average');
    expect(stoneForLevel(110)?.id).toBe('great');
    expect(stoneForLevel(111)?.id).toBe('perfect');
    expect(stoneForLevel(121)).toBeNull();
  });
  it('the owner example: Marksman (ring suffix, tier 4) rolls on rings of level 100 to 120', () => {
    const rolls = (lvl: number) => filterAffixes({ ...base, level: lvl, text: 'marksman' }).length;
    expect(rolls(99)).toBe(0);
    expect(rolls(100)).toBe(1);
    expect(rolls(120)).toBe(1);
    expect(filterAffixes({ ...base, text: 'marksman' })[0]).toMatchObject({ kind: 'suffix', tier: 4 });
  });
});

describe('filters and sorting', () => {
  it('filters by item and kind', () => {
    const boots = filterAffixes({ ...base, item: 'boots', kind: 'suffix' });
    expect(boots.length).toBe(32);
    expect(boots.every((a) => a.item === 'boots' && a.kind === 'suffix')).toBe(true);
  });
  it('only keeps affixes that carry the chosen stat', () => {
    const l = filterAffixes({ ...base, item: 'boots', stat: 'Move Speed' });
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((a) => !!statOf(a, 'Move Speed'))).toBe(true);
  });
  it('sorts the best value of the stat first', () => {
    const l = sortAffixes(filterAffixes({ ...base, item: 'boots', stat: 'Move Speed' }), 'best', 'Move Speed');
    const tops = l.map((a) => statOf(a, 'Move Speed')![2]);
    expect(tops).toEqual([...tops].sort((a, b) => b - a));
    expect(tops[0]).toBe(2.2);
  });
  it('rare first / common first follow the roll weight', () => {
    const l = filterAffixes({ ...base, item: 'bracelet' });
    expect(sortAffixes(l, 'rare', 'all')[0].weight).toBe(1000);
    expect(sortAffixes(l, 'common', 'all')[0].weight).toBe(18000);
  });
});
