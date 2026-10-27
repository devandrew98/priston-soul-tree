import { describe, expect, it } from 'vitest';
import { applyAging, type StatKey, type StatResult, type Stats } from './bonuses';

const val = (r: StatResult, k: StatKey) => (r.ok ? r.rows.find((x) => x.key === k) : undefined);
const gain = (r: StatResult, k: StatKey) => { const x = val(r, k); return x ? Math.round((x.after - x.before) * 100) / 100 : undefined; };

describe('weapon aging', () => {
  const w: Stats = { min: 100, max: 120, rating: 500, crit: 5 };
  it('real Whispering Staff: 234-246, 28% crit, 1394 rating at +0 is 272-284, 39% crit, 1774 rating at +22', () => {
    const r = applyAging('weapon', 120, { min: 234, max: 246, rating: 1394, crit: 28 }, 0, 22);
    expect(r.ok && r.rows.map((x) => [x.key, x.after])).toEqual([['min', 272], ['max', 284], ['rating', 1774], ['crit', 39]]);
  });
  it('has no MP', () => {
    expect(val(applyAging('weapon', 100, w, 0, 22), 'mp' as StatKey)).toBeUndefined();
  });
  it('only the levels between the current and the desired aging count', () => {
    const r = applyAging('weapon', 100, w, 8, 11); // +9 (first band), +10 and +11 (second band)
    expect(gain(r, 'min')).toBe(5);
    expect(gain(r, 'rating')).toBe(50);
    expect(gain(r, 'crit')).toBe(1); // only +10 is an even level
  });
  it('nothing changes when the desired aging is not above the current', () => {
    const r = applyAging('weapon', 100, w, 10, 10);
    expect(gain(r, 'min')).toBe(0);
    expect(r.ok && r.levels).toBe(0);
  });
  it('the item level does not matter for weapons', () => {
    expect(applyAging('weapon', 150, w, 0, 5).ok).toBe(true);
  });
});

describe('armor and robe aging (one type)', () => {
  it('level 103+, +0 -> +22: defense about x2.01 (compounded) and +146 absorb', () => {
    const r = applyAging('armor', 110, { def: 1000, absorb: 100 }, 0, 22);
    expect(val(r, 'def')!.after).toBe(2012); // rounded to an integer at every level
    expect(gain(r, 'absorb')).toBe(146);
  });
  it('uses the table of the item level range', () => {
    expect(gain(applyAging('armor', 30, { def: 100, absorb: 10 }, 0, 9), 'absorb')).toBe(9); // 1 x 9
    expect(gain(applyAging('armor', 60, { def: 100, absorb: 10 }, 0, 9), 'absorb')).toBe(18); // 2 x 9
    expect(gain(applyAging('armor', 90, { def: 100, absorb: 10 }, 0, 9), 'absorb')).toBe(27); // 3 x 9
    expect(gain(applyAging('armor', 103, { def: 100, absorb: 10 }, 0, 9), 'absorb')).toBe(36); // 4 x 9
  });
  it('real Whispering Robe (epic): absorb 345.5 -> 491.5 at +22 is exact', () => {
    const r = applyAging('armor', 120, { def: 1564, absorb: 345.5 }, 0, 22);
    expect(gain(r, 'absorb')).toBe(146);
  });
  it('real Whispering Robe (epic): 1564 defense, perfect 1600, is 3181 at +22', () => {
    const r = applyAging('armor', 120, { def: 1564, absorb: 345.5, defPerfect: 1600 }, 0, 22);
    expect(val(r, 'def')!.after).toBe(3181);
    expect(val(r, 'absorb')!.after).toBe(491.5);
  });
  it('without a perfect value the item is taken as perfect; a perfect lower than the item is ignored', () => {
    const a = applyAging('armor', 120, { def: 1600 }, 0, 22);
    expect(val(a, 'def')!.after).toBe(3217);
    expect(applyAging('armor', 120, { def: 1600, defPerfect: 1500 }, 0, 22)).toEqual(a);
  });
  it('the shortfall to the perfect item does not grow with aging', () => {
    const r1 = applyAging('shield', 120, { def: 900, defPerfect: 1000 }, 0, 10);
    const perfect = applyAging('shield', 120, { def: 1000 }, 0, 10);
    expect(val(perfect, 'def')!.after - val(r1, 'def')!.after).toBe(100);
  });
  it('defense is rounded to an integer at every level, like the database does', () => {
    expect(val(applyAging('armor', 120, { def: 1564 }, 0, 22), 'def')!.after).toBe(3141);
    expect(val(applyAging('armor', 120, { def: 1581 }, 0, 22), 'def')!.after).toBe(3181);
  });
  it('defense compounds: +1 at level 103 is x1.025', () => {
    expect(val(applyAging('armor', 110, { def: 1000, absorb: 0 }, 0, 1), 'def')!.after).toBe(1025);
    expect(val(applyAging('armor', 110, { def: 1000, absorb: 0 }, 0, 2), 'def')!.after).toBe(1051); // 1025, then 1025 + 25.6 rounded
  });
});

describe('shield and orb aging', () => {
  it('level 103+, +0 -> +22: defense about x2.07, +30.4 absorb and +11 block', () => {
    const r = applyAging('shield', 110, { def: 1000, absorb: 20, block: 10 }, 0, 22);
    expect(val(r, 'def')!.after).toBe(2072);
    expect(gain(r, 'absorb')).toBe(30.4);
    expect(gain(r, 'block')).toBe(11);
  });
  it('orbs use the same table as shields', () => {
    const a = applyAging('orb', 90, { def: 500, absorb: 5, block: 2 }, 5, 15);
    const b = applyAging('shield', 90, { def: 500, absorb: 5, block: 2 }, 5, 15);
    expect(a).toEqual(b);
  });
});

describe('limits', () => {
  it('items above level 120 use the 103+ row, as the database does', () => {
    const a = applyAging('armor', 150, { def: 1000, absorb: 100 }, 0, 22);
    const b = applyAging('armor', 110, { def: 1000, absorb: 100 }, 0, 22);
    expect(a).toEqual(b);
    expect(applyAging('orb', 150, { def: 1000, absorb: 1, block: 1 }, 0, 5).ok).toBe(true);
  });
  it('clamps the levels to +1..+22', () => {
    const r = applyAging('weapon', 100, { min: 0 }, 20, 40);
    expect(r.ok && r.levels).toBe(2);
  });
});
