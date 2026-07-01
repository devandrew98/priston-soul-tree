import raw from '../data/souls.json';
import type { Soul, Category, Unit } from './types';

export const SOULS: Soul[] = raw as Soul[];

export const SOULS_BY_ID: Record<string, Soul> = Object.fromEntries(
  SOULS.map((s) => [s.id, s]),
);

export const CATEGORY_LABEL: Record<Category, string> = {
  attack: 'Attack',
  defense: 'Defense',
  support: 'Support',
  pvp: 'PvP',
};

export const CATEGORY_ICON: Record<Category, string> = {
  attack: '⚔️',
  defense: '🛡️',
  support: '⏳',
  pvp: '⚔',
};

export interface StatMeta {
  key: string;
  label: string;
  unit: Unit;
  category: Category; // primary category this stat belongs to
}

// Derive stat metadata from the soul list (first occurrence wins).
export const STAT_META: Record<string, StatMeta> = (() => {
  const m: Record<string, StatMeta> = {};
  for (const s of SOULS) {
    if (!m[s.stat]) {
      m[s.stat] = { key: s.stat, label: s.statLabel, unit: s.unit, category: s.category };
    }
  }
  return m;
})();

export const ALL_STATS: StatMeta[] = Object.values(STAT_META);

export function soulsForCategory(cat: Category): Soul[] {
  return SOULS.filter((s) => s.category === cat);
}

export function soulsForStat(stat: string): Soul[] {
  return SOULS.filter((s) => s.stat === stat);
}
