import type { Category, Rarity } from './types';

export type NodeType = 'atk' | 'def' | 'uti' | 'pvp' | 'wild';

export interface TreeNode {
  id: string;
  col: number; // x: 0..6
  row: number; // y: 0..9
  type: NodeType;
  rarity: Rarity; // FIXED by position — not user selectable
}

export interface TreeEdge {
  a: string; // node id
  b: string; // node id
}

/** Node type -> soul category that can be placed ('wildcard' accepts any). */
export const NODE_CATEGORY: Record<NodeType, Category | 'wildcard'> = {
  atk: 'attack',
  def: 'defense',
  uti: 'support',
  pvp: 'pvp',
  wild: 'wildcard',
};

/** Point cost per node = rarityCost * nodeLevel. */
export const RARITY_POINT_COST: Record<Rarity, number> = {
  common: 1,
  rare: 2,
  legendary: 3,
};

/** Maximum node upgrade level allowed per rarity tier. */
export const MAX_NODE_LEVEL: Record<Rarity, number> = {
  common: 25,
  rare: 15,
  legendary: 5,
};

/** Rarity ordering used to decide what a node accepts (higher index = rarer). */
export const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  legendary: 2,
};

// Asset frame filename per type+rarity (casing is inconsistent in the game files).
const FRAME: Record<NodeType, Record<Rarity, string>> = {
  atk: { common: 'NODE-Com-ATK.png', rare: 'NODE-Rare-ATK.png', legendary: 'NODE-Leg-ATK.png' },
  def: { common: 'NODE-Com-Def.png', rare: 'NODE-Rare-Def.png', legendary: 'NODE-Leg-Def.png' },
  pvp: { common: 'NODE-COM-PVP.png', rare: 'NODE-RARE-PVP.png', legendary: 'NODE-LEG-PVP.png' },
  uti: { common: 'NODE-COM-UTI.png', rare: 'NODE-RARE-UTI.png', legendary: 'NODE-LEG-UTI.png' },
  wild: { common: 'NODE-Com-WILD.png', rare: 'NODE-Rare-WILD.png', legendary: 'NODE-Leg-WILD.png' },
};

export function nodeFrameSrc(type: NodeType, rarity: Rarity): string {
  return `/fusion/${FRAME[type][rarity]}`;
}

export const NODE_TYPE_ICON: Record<NodeType, string> = {
  atk: '/fusion/Core-Card-Icon-ATK.png',
  def: '/fusion/Core-Card-Icon-DEF.png',
  uti: '/fusion/Core-Card-Icon-UTI.png',
  pvp: '/fusion/Core-Card-Icon-PVP.png',
  wild: '/fusion/NODE-Com-WILD.png',
};

// ---------------------------------------------------------------------------
// Tree layout — the official Fusion Tier tree, 36 nodes:
//   24 Common, 8 Rare, 4 Legendary.
// Positions, categories and rarities are reproduced exactly from the in-game
// tree (a 7-column x 10-row grid; x = col, y = row).
// ---------------------------------------------------------------------------

const CAT_TO_TYPE: Record<string, NodeType> = {
  Offensive: 'atk',
  Defensive: 'def',
  Utility: 'uti',
  PVP: 'pvp',
  Wildcard: 'wild',
};
const RARITY_TO_LOWER: Record<string, Rarity> = {
  COMMON: 'common',
  RARE: 'rare',
  LEGENDARY: 'legendary',
};

interface RawNode {
  id: string;
  x: number;
  y: number;
  category: keyof typeof CAT_TO_TYPE;
  rarity: keyof typeof RARITY_TO_LOWER;
}

const RAW_NODES: RawNode[] = [
  { id: 't1', x: 3, y: 0, category: 'Offensive', rarity: 'COMMON' },
  { id: 't2', x: 3, y: 1, category: 'Defensive', rarity: 'COMMON' },
  { id: 'h1_0', x: 0, y: 2, category: 'Offensive', rarity: 'RARE' },
  { id: 'h1_1', x: 1, y: 2, category: 'Offensive', rarity: 'COMMON' },
  { id: 'h1_2', x: 2, y: 2, category: 'Offensive', rarity: 'COMMON' },
  { id: 'h1_3', x: 3, y: 2, category: 'Wildcard', rarity: 'RARE' },
  { id: 'h1_4', x: 4, y: 2, category: 'Defensive', rarity: 'COMMON' },
  { id: 'h1_5', x: 5, y: 2, category: 'Defensive', rarity: 'COMMON' },
  { id: 'h1_6', x: 6, y: 2, category: 'Defensive', rarity: 'RARE' },
  { id: 'lv_3', x: 0, y: 3, category: 'Defensive', rarity: 'COMMON' },
  { id: 'lv_4', x: 0, y: 4, category: 'Offensive', rarity: 'COMMON' },
  { id: 'lv_5', x: 0, y: 5, category: 'Offensive', rarity: 'RARE' },
  { id: 'lv_6', x: 0, y: 6, category: 'Offensive', rarity: 'COMMON' },
  { id: 'cv_3', x: 3, y: 3, category: 'Utility', rarity: 'COMMON' },
  { id: 'cv_4', x: 3, y: 4, category: 'Utility', rarity: 'LEGENDARY' },
  { id: 'cv_5', x: 3, y: 5, category: 'Defensive', rarity: 'COMMON' },
  { id: 'cv_6', x: 3, y: 6, category: 'PVP', rarity: 'COMMON' },
  { id: 'rv_3', x: 6, y: 3, category: 'Offensive', rarity: 'COMMON' },
  { id: 'rv_4', x: 6, y: 4, category: 'Defensive', rarity: 'COMMON' },
  { id: 'rv_5', x: 6, y: 5, category: 'Defensive', rarity: 'RARE' },
  { id: 'rv_6', x: 6, y: 6, category: 'Defensive', rarity: 'COMMON' },
  { id: 'h2_0', x: 0, y: 7, category: 'Defensive', rarity: 'COMMON' },
  { id: 'h2_1', x: 1, y: 7, category: 'Utility', rarity: 'COMMON' },
  { id: 'h2_2', x: 2, y: 7, category: 'Offensive', rarity: 'COMMON' },
  { id: 'h2_3', x: 3, y: 7, category: 'PVP', rarity: 'RARE' },
  { id: 'h2_4', x: 4, y: 7, category: 'Defensive', rarity: 'COMMON' },
  { id: 'h2_5', x: 5, y: 7, category: 'Utility', rarity: 'COMMON' },
  { id: 'h2_6', x: 6, y: 7, category: 'Offensive', rarity: 'COMMON' },
  { id: 'bv0_8', x: 0, y: 8, category: 'Offensive', rarity: 'RARE' },
  { id: 'bv2_8', x: 2, y: 8, category: 'Offensive', rarity: 'COMMON' },
  { id: 'bv2_9', x: 2, y: 9, category: 'Offensive', rarity: 'LEGENDARY' },
  { id: 'bv3_8', x: 3, y: 8, category: 'PVP', rarity: 'COMMON' },
  { id: 'bv3_9', x: 3, y: 9, category: 'PVP', rarity: 'LEGENDARY' },
  { id: 'bv4_8', x: 4, y: 8, category: 'Defensive', rarity: 'COMMON' },
  { id: 'bv4_9', x: 4, y: 9, category: 'Defensive', rarity: 'LEGENDARY' },
  { id: 'bv6_8', x: 6, y: 8, category: 'Defensive', rarity: 'RARE' },
];

const nodes: TreeNode[] = RAW_NODES.map((n) => ({
  id: n.id,
  col: n.x,
  row: n.y,
  type: CAT_TO_TYPE[n.category],
  rarity: RARITY_TO_LOWER[n.rarity],
}));

// Edges reproduce the tree skeleton: the central spine, the two horizontal bars
// (rows 2 and 7), the left/right vertical rails (cols 0 and 6) and the three
// bottom branches.
const EDGE_PAIRS: [string, string][] = [
  // central spine (col 3)
  ['t1', 't2'], ['t2', 'h1_3'], ['h1_3', 'cv_3'], ['cv_3', 'cv_4'],
  ['cv_4', 'cv_5'], ['cv_5', 'cv_6'], ['cv_6', 'h2_3'],
  // top horizontal bar (row 2)
  ['h1_0', 'h1_1'], ['h1_1', 'h1_2'], ['h1_2', 'h1_3'],
  ['h1_3', 'h1_4'], ['h1_4', 'h1_5'], ['h1_5', 'h1_6'],
  // left vertical rail (col 0)
  ['h1_0', 'lv_3'], ['lv_3', 'lv_4'], ['lv_4', 'lv_5'],
  ['lv_5', 'lv_6'], ['lv_6', 'h2_0'], ['h2_0', 'bv0_8'],
  // right vertical rail (col 6)
  ['h1_6', 'rv_3'], ['rv_3', 'rv_4'], ['rv_4', 'rv_5'],
  ['rv_5', 'rv_6'], ['rv_6', 'h2_6'], ['h2_6', 'bv6_8'],
  // bottom horizontal bar (row 7)
  ['h2_0', 'h2_1'], ['h2_1', 'h2_2'], ['h2_2', 'h2_3'],
  ['h2_3', 'h2_4'], ['h2_4', 'h2_5'], ['h2_5', 'h2_6'],
  // bottom branches
  ['h2_2', 'bv2_8'], ['bv2_8', 'bv2_9'],
  ['h2_3', 'bv3_8'], ['bv3_8', 'bv3_9'],
  ['h2_4', 'bv4_8'], ['bv4_8', 'bv4_9'],
];

const edges: TreeEdge[] = EDGE_PAIRS.map(([a, b]) => ({ a, b }));

export const TREE_NODES: TreeNode[] = nodes;
export const TREE_EDGES: TreeEdge[] = edges;
export const TREE_NODE_BY_ID: Record<string, TreeNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));

export const TREE_COLS = 7;
export const TREE_ROWS = Math.max(...nodes.map((n) => n.row)) + 1;

/**
 * Whether a soul (its category + rarity) may be placed on a node.
 * Rules (from the wiki):
 *  - category must match the node type (Wildcard accepts any category);
 *  - the node accepts souls whose rarity is >= the node's own rarity tier;
 *  - Wildcard nodes only accept Rare or Legendary souls.
 */
export function acceptsSoul(
  accepts: Category | 'wildcard',
  nodeRarity: Rarity,
  soulCat: Category,
  soulRarity: Rarity,
): boolean {
  if (accepts === 'wildcard') {
    if (RARITY_ORDER[soulRarity] < RARITY_ORDER['rare']) return false;
  } else if (accepts !== soulCat) {
    return false;
  }
  return RARITY_ORDER[soulRarity] >= RARITY_ORDER[nodeRarity];
}

export function nodeAccepts(node: TreeNode, soulCat: Category, soulRarity: Rarity): boolean {
  return acceptsSoul(NODE_CATEGORY[node.type], node.rarity, soulCat, soulRarity);
}

// Sanity counts (used by a dev check).
export const TYPE_COUNTS = nodes.reduce<Record<NodeType, number>>(
  (m, n) => ((m[n.type] = (m[n.type] || 0) + 1), m),
  { atk: 0, def: 0, uti: 0, pvp: 0, wild: 0 },
);

export const RARITY_COUNTS = nodes.reduce<Record<Rarity, number>>(
  (m, n) => ((m[n.rarity] = (m[n.rarity] || 0) + 1), m),
  { common: 0, rare: 0, legendary: 0 },
);
