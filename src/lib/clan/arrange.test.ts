import { describe, expect, it } from 'vitest';
import { BUFF_CLASSES, SLOT_RESERVE, arrangeFormation, buildFormation, slotsOf, type FormationMember, type PtClass } from './formation';

let n = 0;
const mk = (cls: PtClass, count = 1): FormationMember[] => Array.from({ length: count }, () => ({ id: `m${++n}`, nick: `${cls}${n}`, cls }));
const party = (f: ReturnType<typeof arrangeFormation>, slot: number) => f.raids[Math.floor(slot / 2)].parties[slot % 2].members;
const ids = (ms: FormationMember[]) => ms.map((m) => m.id).sort();

const clan24 = () => [...mk('Archer', 4), ...mk('Shaman', 2), ...mk('Priestess', 3), ...mk('Atalanta', 2), ...mk('Magician', 3), ...mk('Assassin', 2), ...mk('Knight', 4), ...mk('Fighter', 4)];

describe('arrangeFormation without manual placements', () => {
  it('places everybody exactly like the automatic formation', () => {
    const members = clan24();
    const auto = buildFormation(members);
    const f = arrangeFormation(members);
    auto.raids.forEach((r, ri) => r.parties.forEach((p, pi) => expect(ids(party(f, ri * 2 + pi))).toEqual(ids(p.members))));
    expect(f.reserves).toEqual(auto.reserves);
  });
  it('always has 2 raids of 2 parties, an empty one is just empty', () => {
    const f = arrangeFormation(mk('Knight', 5));
    expect(f.raids).toHaveLength(2);
    expect(f.raids.every((r) => r.parties.length === 2)).toBe(true);
    expect(party(f, 2)).toEqual([]);
    expect(f.raids[1].buffs).toEqual([]);
  });
});

describe('arrangeFormation with manual placements', () => {
  it('moves a member to a party that has room', () => {
    const members = mk('Knight', 8);
    const f0 = arrangeFormation(members);
    expect(party(f0, 0)).toHaveLength(4);
    const mover = party(f0, 0)[0];
    const f = arrangeFormation(members.map((m) => (m.id === mover.id ? { ...m, slot: 2 } : m)));
    expect(party(f, 2).map((m) => m.id)).toEqual([mover.id]);
    expect(party(f, 0)).toHaveLength(3);
    expect(slotsOf(f).get(mover.id)).toBe(2);
  });

  it('a pinned member never makes a party go above 6: the one who no longer fits moves to the closest party with room', () => {
    const members = clan24().slice(0, 14); // raid 1 full (6/6), raid 2 with 2
    const f0 = arrangeFormation(members);
    expect(party(f0, 0)).toHaveLength(6);
    const outsider = party(f0, 2)[0];
    const f = arrangeFormation(members.map((m) => (m.id === outsider.id ? { ...m, slot: 0 } : m)));
    for (let s = 0; s < 4; s++) expect(party(f, s).length).toBeLessThanOrEqual(6);
    expect(party(f, 0).some((m) => m.id === outsider.id)).toBe(true);
    expect(Array.from(slotsOf(f).keys()).sort()).toEqual(ids(members));
  });

  it('a swap (both pinned) keeps the sizes', () => {
    const members = clan24();
    const f0 = arrangeFormation(members);
    const a = party(f0, 0)[0], b = party(f0, 3)[0];
    const f = arrangeFormation(members.map((m) => (m.id === a.id ? { ...m, slot: 3 } : m.id === b.id ? { ...m, slot: 0 } : m)));
    expect(party(f, 3).some((m) => m.id === a.id)).toBe(true);
    expect(party(f, 0).some((m) => m.id === b.id)).toBe(true);
    for (let s = 0; s < 4; s++) expect(party(f, s)).toHaveLength(party(f0, s).length);
  });

  it('slot 4 sends a member to the reserves and a reserve can be pinned into a party', () => {
    const members = [...mk('Knight', 24), ...mk('Archer', 2)];
    const f0 = arrangeFormation(members);
    const reserve = f0.reserves[0];
    const benched = party(f0, 0)[0];
    const f = arrangeFormation(members.map((m) => (m.id === benched.id ? { ...m, slot: SLOT_RESERVE } : m.id === reserve.id ? { ...m, slot: 0 } : m)));
    expect(f.reserves.some((m) => m.id === benched.id)).toBe(true);
    expect(party(f, 0).some((m) => m.id === reserve.id)).toBe(true);
    expect(slotsOf(f).size).toBe(members.length);
  });

  it('more than 6 pinned to the same party: the extra ones are placed automatically', () => {
    const members = mk('Knight', 10).map((m) => ({ ...m, slot: 1 }));
    const f = arrangeFormation(members);
    expect(party(f, 1)).toHaveLength(6);
    expect(slotsOf(f).size).toBe(10);
  });

  it('nobody is lost or repeated whatever the placements', () => {
    const members = clan24().map((m, i) => ({ ...m, slot: i % 3 === 0 ? (i % 5) : null }));
    const f = arrangeFormation(members);
    const all = [...f.raids.flatMap((r) => r.parties.flatMap((p) => p.members)), ...f.reserves];
    expect(ids(all)).toEqual(ids(members));
  });

  it('the buffs of each raid are recomputed after a move', () => {
    const members = clan24();
    const f0 = arrangeFormation(members);
    expect(f0.raids[1].buffs).toEqual(BUFF_CLASSES);
    // send every Shaman of raid 2 to raid 1's parties (when they fit) -> raid 2 loses the Shaman buff
    const shamans = f0.raids[1].parties.flatMap((p) => p.members).filter((m) => m.cls === 'Shaman');
    const f = arrangeFormation(members.map((m) => (shamans.some((s) => s.id === m.id) ? { ...m, slot: SLOT_RESERVE } : m)));
    expect(f.raids[1].buffs).not.toContain('Shaman');
  });
});
