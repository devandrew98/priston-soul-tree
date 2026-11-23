import { describe, expect, it } from 'vitest';
import { pollShares, type PollRow } from './poll';

const row = (cls: PollRow['cls'], votes: number, mine = false): PollRow => ({ cls, votes, mine });

describe('pollShares', () => {
  it('lists all ten classes even with no votes', () => {
    const { total, shares } = pollShares([]);
    expect(total).toBe(0);
    expect(shares).toHaveLength(10);
    expect(shares.every((s) => s.pct === 0 && !s.leader)).toBe(true);
  });

  it('orders by votes and computes the percentages', () => {
    const { total, shares } = pollShares([row('knight', 3), row('fighter', 1), row('mechanician', 6, true)]);
    expect(total).toBe(10);
    expect(shares.slice(0, 3).map((s) => [s.cls, s.pct])).toEqual([['mechanician', 60], ['knight', 30], ['fighter', 10]]);
    expect(shares[0].leader).toBe(true);
    expect(shares[0].mine).toBe(true);
    expect(shares[1].leader).toBe(false);
  });

  it('marks every tied leader and keeps class order among ties', () => {
    const { shares } = pollShares([row('atalanta', 2), row('archer', 2), row('fighter', 1)]);
    expect(shares.slice(0, 3).map((s) => s.cls)).toEqual(['archer', 'atalanta', 'fighter']);
    expect(shares.filter((s) => s.leader).map((s) => s.cls)).toEqual(['archer', 'atalanta']);
  });
});
