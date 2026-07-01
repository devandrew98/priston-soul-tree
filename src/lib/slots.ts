import type { Category } from './types';

export interface SlotDef {
  id: string;
  /** category accepted; 'wildcard' accepts any soul */
  accepts: Category | 'wildcard';
  index: number;
}

// Tree capacity per the PristonTale EU wiki:
// 12 Attack, 13 Defense, 4 Support, 4 PvP, 1 Wildcard.
export const SLOT_COUNTS: Record<Category | 'wildcard', number> = {
  attack: 12,
  defense: 13,
  support: 4,
  pvp: 4,
  wildcard: 1,
};

export const SLOT_DEFS: SlotDef[] = (() => {
  const defs: SlotDef[] = [];
  (Object.keys(SLOT_COUNTS) as (Category | 'wildcard')[]).forEach((cat) => {
    for (let i = 0; i < SLOT_COUNTS[cat]; i++) {
      defs.push({ id: `${cat}-${i}`, accepts: cat, index: i });
    }
  });
  return defs;
})();

export const SLOTS_BY_ACCEPT: Record<string, SlotDef[]> = (() => {
  const m: Record<string, SlotDef[]> = {};
  for (const d of SLOT_DEFS) {
    (m[d.accepts] ??= []).push(d);
  }
  return m;
})();

export function slotAccepts(slotAccepts: Category | 'wildcard', soulCat: Category): boolean {
  return slotAccepts === 'wildcard' || slotAccepts === soulCat;
}
