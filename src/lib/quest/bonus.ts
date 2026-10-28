// EXP bonuses: which ones apply to a quest, how they combine (the administrator picks additive or multiplicative; nothing
// is assumed about the real server) and how the reward changes with different sets of bonuses.
import { mulDiv, pctToScaled } from './exp';

/** 100% in the units of pctToScaled (4 decimals of a percent). */
const ONE = 1_000_000;
import type { BonusChoice, CombineMode, ExpBonus, Quest, RoundingMode } from './types';

export interface AppliedBonus { id: string; name: string; percent: number }

export interface BonusResult {
  base: number;
  total: number;
  /** total - base */
  extra: number;
  applied: AppliedBonus[];
  /** What the bonuses add up to, as a percentage of the base (for showing: "+38%"). */
  effectivePercent: number;
}

/** Final EXP for a base value. Exact: one single rounding at the end, whatever the combination. */
export function applyBonuses(base: number, applied: AppliedBonus[], combine: CombineMode, rounding: RoundingMode): BonusResult {
  const scaled = applied.map((b) => pctToScaled(Math.max(0, b.percent)));
  let total: number;
  if (applied.length === 0) total = base;
  else if (combine === 'additive') total = mulDiv(base, ONE + scaled.reduce((a, b) => a + b, 0), ONE, rounding);
  else {
    let num = 1n, den = 1n;
    for (const s of scaled) { num *= BigInt(ONE + s); den *= BigInt(ONE); }
    total = mulDiv(base, num, den, rounding);
  }
  return { base, total, extra: total - base, applied, effectivePercent: base > 0 ? (total / base - 1) * 100 : 0 };
}

/** The percentage a bonus gives for this player: the administrator's for a toggle, the player's own for a manual one. */
export function bonusPercent(b: ExpBonus, choice: BonusChoice | undefined): number {
  if (b.kind === 'manual') return Math.max(0, Math.min(1000, choice?.percent ?? 0));
  return choice?.on ? b.percent : 0;
}

/** The bonuses that are on for the player AND enabled by the administrator AND apply to this category. */
export function activeBonuses(categoryId: string, bonuses: ExpBonus[], choices: Record<string, BonusChoice>): AppliedBonus[] {
  return [...bonuses]
    .filter((b) => b.enabled && (b.appliesTo.length === 0 || b.appliesTo.includes(categoryId)))
    .sort((a, b) => a.sort - b.sort)
    .map((b) => ({ id: b.id, name: b.name, percent: bonusPercent(b, choices[b.id]) }))
    .filter((b) => b.percent > 0);
}

/** The total the bonuses configured add up to in the simple additive reading ("+38%"), for the panel only. */
export function configuredTotal(bonuses: ExpBonus[], choices: Record<string, BonusChoice>, combine: CombineMode): number {
  const list = bonuses.filter((b) => b.enabled).map((b) => bonusPercent(b, choices[b.id])).filter((p) => p > 0);
  return combine === 'additive'
    ? list.reduce((a, b) => a + b, 0)
    : (list.reduce((a, p) => a * (1 + p / 100), 1) - 1) * 100;
}

export function questReward(quest: Quest, bonuses: ExpBonus[], choices: Record<string, BonusChoice>, combine: CombineMode, rounding: RoundingMode): BonusResult | null {
  if (quest.baseExp === null) return null;
  return applyBonuses(quest.baseExp, activeBonuses(quest.categoryId, bonuses, choices), combine, rounding);
}

export interface BonusSetRow {
  /** Names of the bonuses in the set, in order; empty for "no bonuses". */
  names: string[];
  total: number;
  /** Difference to the no-bonus row. */
  extraVsNone: number;
  extraVsNonePct: number;
  /** Difference to the row before. */
  extraVsPrev: number;
}

/**
 * The same quests with growing sets of bonuses: none, the first, the first two... (in the administrator's order), so the
 * player sees what each one adds. Quests without a registered base EXP are skipped; the caller reports them.
 */
export function compareBonusSets(quests: Quest[], bonuses: ExpBonus[], choices: Record<string, BonusChoice>, combine: CombineMode, rounding: RoundingMode): BonusSetRow[] {
  const usable = quests.filter((q) => q.baseExp !== null);
  const order = [...bonuses].filter((b) => b.enabled && bonusPercent(b, choices[b.id]) > 0).sort((a, b) => a.sort - b.sort);
  const rows: BonusSetRow[] = [];
  for (let k = 0; k <= order.length; k++) {
    const set = new Set(order.slice(0, k).map((b) => b.id));
    let total = 0;
    for (const q of usable) {
      const applied = activeBonuses(q.categoryId, bonuses, choices).filter((a) => set.has(a.id));
      total += applyBonuses(q.baseExp as number, applied, combine, rounding).total;
    }
    rows.push({ names: order.slice(0, k).map((b) => b.name), total, extraVsNone: 0, extraVsNonePct: 0, extraVsPrev: 0 });
  }
  const none = rows[0]?.total ?? 0;
  rows.forEach((r, i) => {
    r.extraVsNone = r.total - none;
    r.extraVsNonePct = none > 0 ? (r.extraVsNone / none) * 100 : 0;
    r.extraVsPrev = i === 0 ? 0 : r.total - rows[i - 1].total;
  });
  return rows;
}
