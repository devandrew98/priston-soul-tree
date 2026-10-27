import { describe, expect, it } from 'vitest';
import { attendanceRows } from './attendance';

const members = [{ id: 'b', nick: 'bruno' }, { id: 'a', nick: 'Ana' }, { id: 'c', nick: 'Álvaro' }, { id: 'd', nick: 'Zeca' }];

describe('attendanceRows', () => {
  it('lists every member in alphabetical order, accents and case ignored', () => {
    expect(attendanceRows(members, []).map((r) => r.nick)).toEqual(['Álvaro', 'Ana', 'bruno', 'Zeca']);
  });
  it('counts the BCs of each member and lists them newest first', () => {
    const rows = attendanceRows(members, [
      { id: 'e1', startsAt: 100, memberIds: ['a', 'b'] },
      { id: 'e2', startsAt: 300, memberIds: ['a'] },
      { id: 'e3', startsAt: 200, memberIds: ['a', 'c'] },
    ]);
    const ana = rows.find((r) => r.memberId === 'a')!;
    expect(ana.count).toBe(3);
    expect(ana.dates).toEqual([300, 200, 100]);
    expect(rows.find((r) => r.memberId === 'b')!.count).toBe(1);
    expect(rows.find((r) => r.memberId === 'd')!.count).toBe(0);
  });
  it('ignores people who are no longer in the clan and counts a BC once per member', () => {
    const rows = attendanceRows(members, [{ id: 'e1', startsAt: 1, memberIds: ['a', 'a', 'gone'] }]);
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.memberId === 'a')!.count).toBe(1);
  });
});
