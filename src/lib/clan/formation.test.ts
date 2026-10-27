import { describe, expect, it } from 'vitest';
import { BUFF_CLASSES, MAX_PLAYERS, buildFormation, type FormationMember, type PtClass } from './formation';

let n = 0;
const mk = (cls: PtClass, count = 1): FormationMember[] => Array.from({ length: count }, () => ({ id: `m${++n}`, nick: `${cls}${n}`, cls }));
const all = (f: ReturnType<typeof buildFormation>) => f.raids.flatMap((r) => r.parties.flatMap((p) => p.members));

describe('buildFormation', () => {
  it('empty clan has no raids', () => {
    expect(buildFormation([])).toEqual({ raids: [], reserves: [] });
  });

  it('the 24 members of the board: 2 raids, 4 parties of 6, 5/5 buffs in both raids', () => {
    const members = [...mk('Archer', 4), ...mk('Shaman', 2), ...mk('Priestess', 3), ...mk('Atalanta', 2), ...mk('Magician', 3),
      ...mk('Knight', 3), ...mk('Assassin', 3), ...mk('Fighter', 2), ...mk('Mechanician', 2)];
    expect(members).toHaveLength(24);
    const f = buildFormation(members);
    expect(f.reserves).toEqual([]);
    expect(f.raids).toHaveLength(2);
    for (const r of f.raids) {
      expect(r.buffs).toEqual(BUFF_CLASSES);
      expect(r.parties.map((p) => p.members.length)).toEqual([6, 6]);
    }
  });

  it('nobody is lost or repeated', () => {
    const members = [...mk('Archer', 3), ...mk('Knight', 7), ...mk('Shaman', 1)];
    const f = buildFormation(members);
    expect(new Set(all(f).map((m) => m.id))).toEqual(new Set(members.map((m) => m.id)));
    expect(all(f)).toHaveLength(members.length);
  });

  it('more than 24 confirmed: 24 play, the rest are reserves, and buffs have priority over the order', () => {
    const members = [...mk('Knight', 24), ...mk('Archer', 2), ...mk('Shaman', 2), ...mk('Priestess', 2), ...mk('Atalanta', 2), ...mk('Magician', 2), ...mk('Assassin', 2)];
    const f = buildFormation(members);
    expect(all(f)).toHaveLength(MAX_PLAYERS);
    expect(f.reserves).toHaveLength(members.length - MAX_PLAYERS);
    expect(f.raids.every((r) => r.buffs.length === BUFF_CLASSES.length)).toBe(true);
    expect(f.reserves.every((m) => m.cls === 'Knight')).toBe(true);
  });

  it('the second of each buff goes to raid 2', () => {
    const f = buildFormation([...mk('Knight', 10), ...mk('Archer', 2), ...mk('Shaman', 2), ...mk('Priestess', 2), ...mk('Atalanta', 2), ...mk('Magician', 2), ...mk('Assassin', 2)]);
    const r2 = f.raids[1].parties.flatMap((p) => p.members).map((m) => m.cls);
    for (const c of BUFF_CLASSES) expect(r2).toContain(c);
  });

  it('up to 12 members is a single raid, split in two parties of 6', () => {
    const f = buildFormation([...mk('Archer', 2), ...mk('Shaman'), ...mk('Priestess'), ...mk('Knight', 8)]);
    expect(f.raids).toHaveLength(1);
    expect(f.raids[0].parties.map((p) => p.members.length)).toEqual([6, 6]);
  });

  it('a small clan fills the first party first-come balanced, never above 6 per party', () => {
    const f = buildFormation(mk('Knight', 7));
    expect(f.raids[0].parties.map((p) => p.members.length)).toEqual([4, 3]);
  });

  it('the buff classes of a raid are spread over its two parties', () => {
    const f = buildFormation([...mk('Archer', 2), ...mk('Shaman'), ...mk('Priestess', 2), ...mk('Atalanta'), ...mk('Magician'), ...mk('Knight', 5)]);
    const [a, b] = f.raids[0].parties.map((p) => p.members.filter((m) => BUFF_CLASSES.includes(m.cls)).length);
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
    const ca = f.raids[0].parties[0].members.filter((m) => m.cls === 'Archer').length;
    expect(ca).toBe(1);
  });

  it('missing buff classes are reported by the raid', () => {
    const f = buildFormation([...mk('Archer', 2), ...mk('Knight', 4)]);
    expect(f.raids[0].buffs).toEqual(['Archer']);
  });
});
