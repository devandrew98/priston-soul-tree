// Quest lists are split by map so a player finds the quests of the area they are hunting in. Inside a map the quests that give the
// most EXP come first. A quest always stays in its own map, even when it gives more EXP than a quest of a higher-level map.
export interface MapGroup<T> { map: string; items: T[] }

export const NO_MAP = '—';

/** Maps ordered from the highest level to the lowest (a map's level = the highest minimum level among its quests); quests by EXP, highest first. */
export function groupByMap<T>(items: T[], mapOf: (t: T) => string, expOf: (t: T) => number, levelOf: (t: T) => number | null, nameOf: (t: T) => string): MapGroup<T>[] {
  const by = new Map<string, T[]>();
  for (const it of items) {
    const key = mapOf(it).trim() || NO_MAP;
    by.set(key, [...(by.get(key) ?? []), it]);
  }
  const groups: (MapGroup<T> & { level: number })[] = [...by.entries()].map(([map, list]) => ({
    map, level: Math.max(...list.map((t) => levelOf(t) ?? 0)),
    items: [...list].sort((a, b) => expOf(b) - expOf(a) || nameOf(a).localeCompare(nameOf(b))),
  }));
  groups.sort((a, b) => b.level - a.level || a.map.localeCompare(b.map));
  return groups.map(({ map, items: its }) => ({ map, items: its }));
}
