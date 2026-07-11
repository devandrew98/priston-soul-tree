import type { Build, SlotState, Rarity, Unit } from './types';
import { SOULS_BY_ID } from './souls';
import { nodeFinalValue } from './formula';
import { RARITY_POINT_COST, TREE_NODE_BY_ID } from './tree';
import { unlockedFor } from './graph';

export interface StatTotal {
  key: string;
  label: string;
  unit: Unit;
  value: number;
  isPvp: boolean;
}

export interface SlotStatValue {
  stat: string;
  label: string;
  unit: Unit;
  value: number;
}

/** Rarity of the node a slot sits in (fixed by tree position). */
function slotRarity(slotId: string): Rarity {
  return TREE_NODE_BY_ID[slotId]?.rarity ?? 'common';
}

/** The value each of a slot's stats contributes (a soul may grant several). */
export function slotStatValues(slot: SlotState, nodeRarity: Rarity): SlotStatValue[] {
  if (!slot.soulId) return [];
  const soul = SOULS_BY_ID[slot.soulId];
  if (!soul) return [];
  return soul.stats.map((st) => ({
    stat: st.stat,
    label: st.statLabel,
    unit: st.unit,
    value: nodeFinalValue(st.ranks[slot.soulLevel - 1], nodeRarity, slot.nodeLevel),
  }));
}

/** Combined magnitude of a slot (sum of its stat values) — used for coarse sorting. */
export function slotValue(slot: SlotState, nodeRarity: Rarity): number {
  return slotStatValues(slot, nodeRarity).reduce((s, sv) => s + sv.value, 0);
}

/** Aggregate all slots in a build into per-stat totals. */
export function computeTotals(build: Build): StatTotal[] {
  const acc: Record<string, StatTotal> = {};
  for (const [slotId, slot] of Object.entries(build.slots)) {
    if (!slot.soulId) continue;
    const soul = SOULS_BY_ID[slot.soulId];
    if (!soul) continue;
    const isPvp = soul.category === 'pvp';
    for (const sv of slotStatValues(slot, slotRarity(slotId))) {
      if (sv.value === 0) continue;
      const key = (isPvp ? 'pvp:' : '') + sv.stat;
      if (!acc[key]) {
        acc[key] = { key: sv.stat, label: sv.label, unit: sv.unit, value: 0, isPvp };
      }
      acc[key].value += sv.value;
    }
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

/**
 * Total fusion points spent by a build. Every node must be OPENED to be used, and
 * you can only open a node connected to the top — so this also counts the empty
 * pass-through nodes needed to connect each soul back to the root (each at level 1).
 */
export function pointsSpent(build: Build): number {
  const souled = Object.entries(build.slots)
    .filter(([, s]) => s.soulId)
    .map(([id]) => id);
  const terminals = [...new Set([...souled, ...(build.opened ?? [])])];
  if (!terminals.length) return 0;
  const openedSet = new Set(build.opened ?? []);
  let sum = 0;
  for (const id of unlockedFor(terminals)) {
    const slot = build.slots[id];
    // Nodes com soul E nodes vazios ABERTOS contam o nível investido (no jogo
    // os pontos ficam no node mesmo sem soul); pass-through automático = 1.
    const level = slot && (slot.soulId || openedSet.has(id)) ? Math.max(1, slot.nodeLevel) : 1;
    sum += RARITY_POINT_COST[slotRarity(id)] * level;
  }
  return sum;
}
