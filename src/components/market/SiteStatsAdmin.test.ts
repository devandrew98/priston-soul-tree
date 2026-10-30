import { describe, expect, it } from 'vitest';
import { hoursLocal } from './SiteStatsAdmin';

describe('hoursLocal', () => {
  it('moves UTC hours into the viewer timezone (Brasília is UTC-3, offset +180)', () => {
    const out = hoursLocal([{ h: 0, views: 5 }, { h: 12, views: 2 }], 180);
    expect(out[21]).toBe(5);
    expect(out[9]).toBe(2);
    expect(out.reduce((a, b) => a + b, 0)).toBe(7);
  });
  it('wraps around midnight both ways', () => {
    expect(hoursLocal([{ h: 23, views: 1 }], -120)[1]).toBe(1);
  });
});
