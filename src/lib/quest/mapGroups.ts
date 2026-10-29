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

/** The boss hunts (given by the NPC "Boss Hunter, William") and the solo quests are each listed together in one block, after all the maps. */
export const BOSS_GROUP = 'Boss Hunter (William)';
export const SOLO_GROUP = 'Solo Quests';
export const isBossHunt = (q: { npc: string }): boolean => /boss hunter/i.test(q.npc);
export const isSoloListed = (q: { name: string }): boolean => /^Solo Quest\s*\|/i.test(q.name) || /^\[SOLO\]/i.test(q.name);

/** Hard-mode maps are written "Name [H]" (the export has "Forge of the Ancients H"). */
export const displayMap = (map: string): string => map.trim().replace(/\s+H$/, ' [H]');

/** The block a quest is listed under. */
export const questMapGroup = (q: { map: string; npc: string; name: string }): string => (isSoloListed(q) ? SOLO_GROUP : isBossHunt(q) ? BOSS_GROUP : displayMap(q.map));

/**
 * The quest list: the maps from the highest level to the lowest (the most EXP first inside each), then the boss hunts (by the level of
 * their map, then EXP), then the solo quests. A quest always stays in its own block.
 */
export function groupQuests<T>(items: T[], quest: (t: T) => { map: string; npc: string; name: string; minLevel: number | null }, expOf: (t: T) => number): MapGroup<T>[] {
  const groups = groupByMap(items, (t) => questMapGroup(quest(t)), expOf, (t) => quest(t).minLevel, (t) => quest(t).name);
  const boss = groups.find((g) => g.map === BOSS_GROUP);
  if (boss) boss.items.sort((a, b) => (quest(b).minLevel ?? 0) - (quest(a).minLevel ?? 0) || expOf(b) - expOf(a) || quest(a).name.localeCompare(quest(b).name));
  const rank = (g: MapGroup<T>) => (g.map === SOLO_GROUP ? 2 : g.map === BOSS_GROUP ? 1 : 0);
  return groups.map((g, idx) => ({ g, idx })).sort((a, b) => rank(a.g) - rank(b.g) || a.idx - b.idx).map((x) => x.g);
}
