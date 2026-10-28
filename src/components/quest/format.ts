import { statePct, type ExpState, type ExpTable } from '../../lib/quest/exp';

export type Lang = 'pt' | 'en';
const loc = (lang: Lang) => (lang === 'pt' ? 'pt-BR' : 'en-US');

/** An EXP amount with thousand separators. */
export const fmtExp = (n: number, lang: Lang): string => n.toLocaleString(loc(lang));

/** A percentage with up to `digits` decimals ("72,5%"). */
export const fmtPct = (p: number, lang: Lang, digits = 2): string =>
  `${p.toLocaleString(loc(lang), { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;

/** "Level 70 · 12,34%" or, when the table lacks the level, just the level. */
export const fmtPos = (table: ExpTable, s: ExpState, lang: Lang, levelWord = 'Level'): string => {
  const p = statePct(table, s);
  return p === null ? `${levelWord} ${s.level}` : `${levelWord} ${s.level} · ${fmtPct(p, lang)}`;
};

/** Typed decimal ("12,5" or "12.5") -> number, NaN when it is not a number. */
export const parseDecimal = (t: string): number => Number(t.trim().replace(',', '.'));
