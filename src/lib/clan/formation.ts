// Bless Castle formation: confirmed clan members -> raids of 2 parties of 6, spreading the buff classes over the raids.
// Pure logic, no UI and no database, so it can be tested and reused.

export const PT_CLASSES = [
  'Fighter', 'Mechanician', 'Archer', 'Pikeman', 'Atalanta', 'Knight', 'Magician', 'Priestess', 'Assassin', 'Shaman',
] as const;
export type PtClass = (typeof PT_CLASSES)[number];

/** Classes whose buff a raid needs (6: Archer, Shaman, Priestess, Atalanta, Magician, Assassin). Change here to add or remove one. */
export const BUFF_CLASSES: readonly PtClass[] = ['Archer', 'Shaman', 'Priestess', 'Atalanta', 'Magician', 'Assassin'];

export const PARTY_SIZE = 6;
export const PARTIES_PER_RAID = 2;
export const RAID_SIZE = PARTY_SIZE * PARTIES_PER_RAID;
export const MAX_RAIDS = 2;
export const MAX_PLAYERS = RAID_SIZE * MAX_RAIDS;

/** `slot` is a manual placement by the leader: 0-3 = that party (raid 1: 0 and 1, raid 2: 2 and 3), 4 = reserves, null/undefined = automatic. */
export interface FormationMember { id: string; nick: string; cls: PtClass; slot?: number | null }

export const PARTY_SLOTS = PARTIES_PER_RAID * MAX_RAIDS;
export const SLOT_RESERVE = PARTY_SLOTS;
export interface Party { members: FormationMember[] }
export interface Raid { parties: Party[]; buffs: PtClass[] }
export interface Formation {
  raids: Raid[];
  /** Confirmed members that did not fit in the 2 raids (more than 24 confirmed). */
  reserves: FormationMember[];
}

const buffOrder = (cls: PtClass) => BUFF_CLASSES.indexOf(cls);
const isBuff = (m: FormationMember) => buffOrder(m.cls) >= 0;

/** Deals the members into the parties alternately: same-class buffs end up in different parties. */
function splitParties(members: FormationMember[]): Party[] {
  const sorted = [...members].sort((a, b) => {
    const ba = isBuff(a), bb = isBuff(b);
    if (ba !== bb) return ba ? -1 : 1;
    return ba ? buffOrder(a.cls) - buffOrder(b.cls) : 0;
  });
  const parties: Party[] = Array.from({ length: PARTIES_PER_RAID }, () => ({ members: [] }));
  sorted.forEach((m, i) => parties[i % PARTIES_PER_RAID].members.push(m));
  return parties;
}

const buffsOf = (members: FormationMember[]) => BUFF_CLASSES.filter((c) => members.some((m) => m.cls === c));

/**
 * `confirmed` is in priority order (the first ones are the first to get a spot when there are more than 24).
 * Every raid gets one of each buff class when the clan has enough of them; the second of each class goes to raid 2.
 */
export function buildFormation(confirmed: FormationMember[]): Formation {
  const cap = Math.min(confirmed.length, MAX_PLAYERS);
  if (cap === 0) return { raids: [], reserves: [] };

  // Priority order: 1st of each buff class, then 2nd of each buff class, then everybody else.
  const seen = new Map<PtClass, number>();
  const firsts: FormationMember[] = [], seconds: FormationMember[] = [], rest: FormationMember[] = [];
  for (const m of confirmed) {
    const n = isBuff(m) ? (seen.get(m.cls) ?? 0) : -1;
    if (isBuff(m)) seen.set(m.cls, n + 1);
    (n === 0 ? firsts : n === 1 ? seconds : rest).push(m);
  }
  const chosen = new Set([...firsts, ...seconds, ...rest].slice(0, cap));
  const reserves = confirmed.filter((m) => !chosen.has(m));

  const size1 = Math.min(RAID_SIZE, cap);
  const size2 = cap - size1;
  const raid1: FormationMember[] = firsts.filter((m) => chosen.has(m));
  const raid2: FormationMember[] = seconds.filter((m) => chosen.has(m)).slice(0, size2);
  // Whoever is left (non-buff classes, extra buffs, seconds that did not fit) fills raid 1 up to 12, then raid 2.
  const placed = new Set([...raid1, ...raid2]);
  for (const m of confirmed) {
    if (!chosen.has(m) || placed.has(m)) continue;
    (raid1.length < size1 ? raid1 : raid2).push(m);
  }

  const raids = [raid1, raid2].filter((r) => r.length > 0).map((members) => ({ parties: splitParties(members), buffs: buffsOf(members) }));
  return { raids, reserves };
}

/**
 * The formation with the leader's manual placements applied on top of the automatic one.
 * Always 2 raids x 2 parties (an empty one is just empty), so a party keeps the same number wherever it is shown.
 * - A member with `slot` 0-3 is placed in that party (at most 6 per party), 4 sends them to the reserves.
 * - Everybody else stays where the automatic formation put them; whoever no longer fits moves to the closest party with room
 *   (the same raid first) or to the reserves.
 */
export function arrangeFormation(confirmed: FormationMember[]): Formation {
  const isBench = (m: FormationMember) => m.slot === SLOT_RESERVE;
  const isPinned = (m: FormationMember) => typeof m.slot === 'number' && m.slot >= 0 && m.slot < PARTY_SLOTS;
  const base = buildFormation(confirmed.filter((m) => !isBench(m)));
  const baseParty = (i: number) => base.raids[Math.floor(i / PARTIES_PER_RAID)]?.parties[i % PARTIES_PER_RAID]?.members ?? [];

  const final: FormationMember[][] = Array.from({ length: PARTY_SLOTS }, () => []);
  const placed = new Set<string>();
  for (const m of confirmed) {
    if (isPinned(m) && final[m.slot as number].length < PARTY_SIZE) { final[m.slot as number].push(m); placed.add(m.id); }
  }
  const leftovers: { m: FormationMember; from: number }[] = [];
  for (let i = 0; i < PARTY_SLOTS; i++) {
    for (const m of baseParty(i)) {
      if (placed.has(m.id)) continue;
      if (final[i].length < PARTY_SIZE) final[i].push(m); else leftovers.push({ m, from: i });
    }
  }
  const reserves = base.reserves.filter((m) => !placed.has(m.id));
  for (const { m, from } of leftovers) {
    const open = final.map((p, i) => ({ i, size: p.length })).filter((p) => p.size < PARTY_SIZE);
    const sameRaid = (i: number) => Number(Math.floor(i / PARTIES_PER_RAID) !== Math.floor(from / PARTIES_PER_RAID));
    open.sort((a, b) => sameRaid(a.i) - sameRaid(b.i) || a.size - b.size || a.i - b.i);
    if (open.length) final[open[0].i].push(m); else reserves.push(m);
  }

  const raids: Raid[] = Array.from({ length: MAX_RAIDS }, (_, r) => {
    const parties = Array.from({ length: PARTIES_PER_RAID }, (_, p) => ({ members: final[r * PARTIES_PER_RAID + p] }));
    return { parties, buffs: buffsOf(parties.flatMap((p) => p.members)) };
  });
  return { raids, reserves: [...reserves, ...confirmed.filter(isBench)] };
}

/** Where each member of a formation is: a party number (0-3) or SLOT_RESERVE. */
export function slotsOf(f: Formation): Map<string, number> {
  const out = new Map<string, number>();
  f.raids.forEach((r, ri) => r.parties.forEach((p, pi) => p.members.forEach((m) => out.set(m.id, ri * PARTIES_PER_RAID + pi))));
  f.reserves.forEach((m) => out.set(m.id, SLOT_RESERVE));
  return out;
}
