import type { Build, SlotState, Rarity } from './types';
import { SOULS_BY_ID, STAT_META } from './souls';
import { nodeFinalValue } from './formula';
import { RARITY_POINT_COST, TREE_NODE_BY_ID } from './tree';

export interface StatTotal {
  key: string;
  label: string;
  unit: 'flat' | 'pct';
  value: number;
  isPvp: boolean;
}

/** Rarity of the node a slot sits in (fixed by tree position). */
function slotRarity(slotId: string): Rarity {
  return TREE_NODE_BY_ID[slotId]?.rarity ?? 'common';
}

export function slotValue(slot: SlotState, nodeRarity: Rarity): number {
  if (!slot.soulId) return 0;
  const soul = SOULS_BY_ID[slot.soulId];
  if (!soul) return 0;
  const base = soul.ranks[slot.soulLevel - 1];
  return nodeFinalValue(base, nodeRarity, slot.nodeLevel);
}

/** Aggregate all slots in a build into per-stat totals. */
export function computeTotals(build: Build): StatTotal[] {
  const acc: Record<string, StatTotal> = {};
  for (const [slotId, slot] of Object.entries(build.slots)) {
    if (!slot.soulId) continue;
    const soul = SOULS_BY_ID[slot.soulId];
    if (!soul) continue;
    const v = slotValue(slot, slotRarity(slotId));
    if (v === 0) continue;
    const isPvp = soul.category === 'pvp';
    const key = (isPvp ? 'pvp:' : '') + soul.stat;
    if (!acc[key]) {
      const meta = STAT_META[soul.stat];
      acc[key] = {
        key: soul.stat,
        label: meta?.label ?? soul.statLabel,
        unit: soul.unit,
        value: 0,
        isPvp,
      };
    }
    acc[key].value += v;
  }
  return Object.values(acc).sort((a, b) => {
    if (a.isPvp !== b.isPvp) return a.isPvp ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
}

export function countFilled(build: Build): number {
  return Object.values(build.slots).filter((s) => s.soulId).length;
}

/** Point cost of a single placed node: rarityCost * nodeLevel. */
export function nodePointCost(slot: SlotState, nodeRarity: Rarity): number {
  if (!slot.soulId) return 0;
  return RARITY_POINT_COST[nodeRarity] * Math.max(1, slot.nodeLevel);
}

/** Total fusion points spent by a build. */
export function pointsSpent(build: Build): number {
  return Object.entries(build.slots).reduce(
    (sum, [slotId, s]) => sum + nodePointCost(s, slotRarity(slotId)),
    0,
  );
}
