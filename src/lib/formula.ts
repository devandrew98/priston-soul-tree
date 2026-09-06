import type { Rarity } from './types';

/** Limite de SANIDADE (guarda-corpo) — NÃO é o cap atual do servidor.
 *  Quem manda no nível de fusão é o jogador: ele digita o próprio nível no
 *  painel e a árvore recalcula os pontos (16 + nível) e tudo mais sozinha.
 *  Este teto só existe pra barrar valores absurdos (erro de digitação) que
 *  fariam o gerador travar. Deixe bem alto — não precisa mexer todo mês. */
export const MAX_FUSION_LEVEL = 400;
export const MAX_FUSION_POINTS = 16 + MAX_FUSION_LEVEL; // 416

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
