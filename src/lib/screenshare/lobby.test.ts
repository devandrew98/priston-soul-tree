import { describe, expect, it } from 'vitest';
import { parseLobby } from './lobby';
import { MAX_VIEWERS } from './p2p';

const entry = (over: Record<string, unknown> = {}) => [{ code: 'ABCD2345', title: 'Guild Run', locked: false, viewers: 2, since: 100, ...over }];

describe('parseLobby', () => {
  it('reads valid rooms, newest first', () => {
    const rooms = parseLobby({ a: entry({ since: 100 }), b: entry({ code: 'WXYZ6789', title: 'Boss', locked: true, since: 200 }) });
    expect(rooms.map((r) => r.code)).toEqual(['WXYZ6789', 'ABCD2345']);
    expect(rooms[0]).toMatchObject({ title: 'Boss', locked: true });
  });

  it('drops records with invalid codes or garbage shapes', () => {
    const rooms = parseLobby({
      a: entry({ code: 'nope' }),
      b: [null as unknown as object],
      c: [] as unknown[],
      d: entry({ code: 'ABCD2345' }),
    });
    expect(rooms.map((r) => r.code)).toEqual(['ABCD2345']);
  });

  it('clamps the viewer count and tidies the title', () => {
    const [room] = parseLobby({ a: entry({ viewers: 999, title: '  x'.repeat(40) }) });
    expect(room.viewers).toBe(MAX_VIEWERS);
    expect(room.title.length).toBeLessThanOrEqual(24);
  });

  it('shows a room once even if two records claim the same code', () => {
    expect(parseLobby({ a: entry(), b: entry() })).toHaveLength(1);
  });
});
