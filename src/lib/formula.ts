import type { Rarity } from './types';

/** Hard game caps: fusion level tops out at 201, which yields 217 fusion
 *  points (16 for levels 1-80 + 1 per fusion level). NOTHING in the app —
 *  UI, generators or the deep-search engine — may ever exceed these. */
export const MAX_FUSION_LEVEL = 201;
export const MAX_FUSION_POINTS = 217;

/** Rarity multipliers for the Fusion Tier node formula. */
export const RARITY_MULT: Record<Rarity, number> = {
  common: 18,
  rare: 26,
  legendary: 34,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  legendary: 'Legendary',
};

/**
 * Fusion Tier node formula.
 * finalValue = base * ((mult*(nodeLevel-1)+100)/100) / (1 + (nodeLevel-1)/21)
 */
export function nodeFinalValue(base: number, rarity: Rarity, nodeLevel: number): number {
  const mult = RARITY_MULT[rarity];
  const n = Math.max(1, nodeLevel);
  return (base * ((mult * (n - 1) + 100) / 100)) / (1 + (n - 1) / 21);
}

/** Normalized multiplier (finalValue / base) for display. */
export function nodeMultiplier(rarity: Rarity, nodeLevel: number): number {
  return nodeFinalValue(1, rarity, nodeLevel);
}

export function fmt(value: number, unit: 'flat' | 'pct'): string {
  if (unit === 'pct') return value.toFixed(2) + '%';
  return value.toFixed(2);
}
