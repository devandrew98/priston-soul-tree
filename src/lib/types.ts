export type Category = 'attack' | 'defense' | 'support' | 'pvp';
export type Rarity = 'common' | 'rare' | 'legendary';
export type Unit = 'flat' | 'pct';

export interface Soul {
  id: string;
  name: string;
  mapLevel: number | null;
  category: Category;
  stat: string;
  statLabel: string;
  unit: Unit;
  ranks: [number, number, number]; // soul level 1 / 2 / 3 base value
  img: string | null; // path to soul icon in /public
  rarity: Rarity; // soul's own rarity tier
  isPvp: boolean; // soul contributes a PvP-only stat
}

/**
 * A single placed node in a build.
 * The node's rarity is fixed by its position in the tree (see tree.ts), so it is
 * NOT stored here — read it from TREE_NODE_BY_ID[slotId].rarity instead.
 */
export interface SlotState {
  soulId: string | null;
  soulLevel: 1 | 2 | 3; // which rank of the soul is active
  nodeLevel: number; // node upgrade level (>=1)
}

export interface Build {
  id: string;
  name: string;
  slots: Record<string, SlotState>; // keyed by slot id
  createdAt: number;
  updatedAt: number;
}

/** Soul ownership: id -> highest soul level owned (1..3). Absent = not owned. */
export type Inventory = Record<string, 1 | 2 | 3>;
