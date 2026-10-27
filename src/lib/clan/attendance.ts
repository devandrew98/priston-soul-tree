// Attendance history: how many Bless Castles each member took part in, and which ones.

export interface AttendanceEvent { id: string; startsAt: number; memberIds: string[] }
export interface AttendanceRow { memberId: string; nick: string; count: number; /** The BCs (start times) the member took part in, newest first. */ dates: number[] }

/** One row per current member, in alphabetical order (accents and case ignored), with the BCs they took part in. */
export function attendanceRows(members: { id: string; nick: string }[], events: AttendanceEvent[]): AttendanceRow[] {
  const byMember = new Map<string, number[]>();
  for (const e of events) {
    for (const id of new Set(e.memberIds)) {
      const list = byMember.get(id) ?? [];
      list.push(e.startsAt);
      byMember.set(id, list);
    }
  }
  return members
    .map((m) => {
      const dates = (byMember.get(m.id) ?? []).sort((a, b) => b - a);
      return { memberId: m.id, nick: m.nick, count: dates.length, dates };
    })
    .sort((a, b) => a.nick.localeCompare(b.nick, 'pt-BR', { sensitivity: 'base' }));
}
