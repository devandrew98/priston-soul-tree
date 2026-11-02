import { describe, expect, it } from 'vitest';
import { SOULS } from './souls';
import { CATALOG, EMPTY_QUERY, MAPS, filterCatalog, plain, sortCatalog } from './soulsCatalog';

describe('catalog data', () => {
  it('has every soul of the tree, each with a level and a place', () => {
    expect(CATALOG.length).toBe(SOULS.length);
    for (const c of CATALOG) {
      expect(c.level).toBeGreaterThan(0);
      expect(c.where.length).toBeGreaterThan(0);
    }
  });
  it('fills the level of souls the tree has none for from the sheet', () => {
    expect(CATALOG.find((c) => c.soul.name.startsWith('Kelvezu'))?.level).toBe(92);
  });
  it('lists real maps only (no "Todos os mapas" rule), without the spelling variants', () => {
    expect(MAPS.some((m) => /^todos/i.test(m))).toBe(false);
    expect(MAPS).toContain('Forest of Spirits');
    expect(MAPS).not.toContain('Florest of Spirits');
  });
});

describe('filters and sorting', () => {
  it('filters by category', () => {
    const l = filterCatalog({ ...EMPTY_QUERY, category: 'pvp' });
    expect(l.length).toBe(CATALOG.filter((c) => c.soul.category === 'pvp').length);
  });
  it('filters by map and by stat, and the search covers name, stat and map', () => {
    expect(filterCatalog({ ...EMPTY_QUERY, map: 'Oasis' }).every((c) => c.where.some((w) => w[0] === 'Oasis'))).toBe(true);
    expect(filterCatalog({ ...EMPTY_QUERY, stat: 'Block' }).every((c) => c.soul.stats.some((s) => s.statLabel === 'Block'))).toBe(true);
    expect(filterCatalog({ ...EMPTY_QUERY, text: 'headcut' }).map((c) => c.soul.name)).toContain('Headcutter');
    expect(filterCatalog({ ...EMPTY_QUERY, text: 'oasis' }).length).toBeGreaterThan(0);
  });
  it('sorts by level and by the best value of the chosen stat', () => {
    const lv = sortCatalog(CATALOG, 'level', 'all').map((c) => c.level);
    expect(lv).toEqual([...lv].sort((a, b) => a - b));
    const l = sortCatalog(filterCatalog({ ...EMPTY_QUERY, stat: 'Attack Power' }), 'stat', 'Attack Power');
    const tops = l.map((c) => c.soul.stats.find((s) => s.statLabel === 'Attack Power')!.ranks[2]);
    expect(tops).toEqual([...tops].sort((a, b) => b - a));
  });
  it('prints numbers without trailing zeros', () => {
    expect(plain(1)).toBe('1');
    expect(plain(0.25)).toBe('0.25');
  });
});

describe('icons', () => {
  it('every soul has an icon (the tree has none for Vault Knight, the catalog uses its _d file)', () => {
    for (const c of CATALOG) expect(c.soul.img).toBeTruthy();
  });
});
