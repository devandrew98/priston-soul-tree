// Season poll (the notice on the Home): turns the vote counts into the bars that are shown. Pure, so it can be tested.
import { CLASS_SLUGS, type ClassSlug } from './skilltree/types';

export const POLL_ID = 'temporada-13';

export interface PollRow { cls: ClassSlug; votes: number; mine: boolean }
export interface PollShare extends PollRow { pct: number; leader: boolean }

/** Every class with its share of the votes (whole percent), most voted first; ties keep the usual class order. */
export function pollShares(rows: PollRow[]): { total: number; shares: PollShare[] } {
  const by = new Map(rows.map((r) => [r.cls, r]));
  const all = CLASS_SLUGS.map((cls) => by.get(cls) ?? { cls, votes: 0, mine: false });
  const total = all.reduce((s, r) => s + r.votes, 0);
  const top = Math.max(0, ...all.map((r) => r.votes));
  const shares = all
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.votes - a.r.votes || a.i - b.i)
    .map(({ r }) => ({ ...r, pct: total ? Math.round((r.votes / total) * 100) : 0, leader: top > 0 && r.votes === top }));
  return { total, shares };
}
