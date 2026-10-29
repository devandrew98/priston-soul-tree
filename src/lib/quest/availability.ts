// Which quests a character can do: level range, prerequisites, repetition and the progress the player recorded by hand.
import type { Character, Quest, QuestProgress, QuestStatus } from './types';

const HOUR = 3_600_000;

export type LockReason = 'level_min' | 'level_max' | 'prerequisite';
export interface StatusInfo {
  status: QuestStatus;
  reasons: LockReason[];
  /** Repeatable quests already delivered: when they can be done again (ms), null when they can now. */
  nextAvailableAt: number | null;
}

export const isDelivered = (p: QuestProgress | undefined): boolean => !!p && (p.deliveries.length > 0 || p.status === 'completed');

export const lastDelivery = (p: QuestProgress | undefined): number | null => (p && p.deliveries.length ? p.deliveries[p.deliveries.length - 1] : null);

/** Hours between two deliveries of a repeatable quest; null for a quest done only once and for one with no wait. */
export function repeatHours(q: Quest): number | null {
  if (q.repeatType === 'daily') return 24;
  if (q.repeatType === 'interval') return q.repeatIntervalHours && q.repeatIntervalHours > 0 ? q.repeatIntervalHours : null;
  return null;
}

/** For a quest delivered before: when it can be started again (ms), or null when it can be done again right away. */
export function nextAvailableAt(q: Quest, p: QuestProgress | undefined, now: number): number | null {
  const last = lastDelivery(p);
  const h = repeatHours(q);
  if (last === null || h === null) return null;
  const at = last + h * HOUR;
  return at > now ? at : null;
}

/** The game registers 150 as the maximum level of quests that have no real cap, so 150 means "no maximum". */
export const NO_CAP_LEVEL = 150;

export function questInfo(q: Quest, char: Pick<Character, 'level' | 'progress'>, now: number): StatusInfo {
  const prog = char.progress[q.id];
  const reasons: LockReason[] = [];
  if (q.minLevel !== null && char.level < q.minLevel) reasons.push('level_min');
  if (q.maxLevel !== null && q.maxLevel < NO_CAP_LEVEL && char.level > q.maxLevel) reasons.push('level_max');
  if (q.prerequisites.some((id) => !isDelivered(char.progress[id]))) reasons.push('prerequisite');
  if (reasons.length) return { status: 'locked', reasons, nextAvailableAt: null };

  if (isDelivered(prog) && (prog?.status === 'completed' || prog?.deliveries.length)) {
    if (q.repeatType === 'once') return { status: 'completed', reasons: [], nextAvailableAt: null };
    const next = nextAvailableAt(q, prog, now);
    if (next !== null) return { status: 'completed', reasons: [], nextAvailableAt: next };
    // a repeatable quest whose wait is over is available again, unless the player already started the new run
    if (prog && (prog.status === 'in_progress' || prog.status === 'ready')) return { status: prog.status, reasons: [], nextAvailableAt: null };
    return { status: 'available', reasons: [], nextAvailableAt: null };
  }
  if (prog?.status === 'in_progress') return { status: 'in_progress', reasons: [], nextAvailableAt: null };
  if (prog?.status === 'ready') return { status: 'ready', reasons: [], nextAvailableAt: null };
  return { status: 'available', reasons: [], nextAvailableAt: null };
}

/** Quests the public side can show at all: registered, turned on and not archived. */
export const visibleQuests = (quests: Quest[]): Quest[] => quests.filter((q) => q.active && !q.archived);

export interface ListedQuest { quest: Quest; info: StatusInfo }

/** The default list: quests the character can do now (available, in progress, ready). */
export function availableList(quests: Quest[], char: Pick<Character, 'level' | 'progress'>, now: number): ListedQuest[] {
  return visibleQuests(quests)
    .map((quest) => ({ quest, info: questInfo(quest, char, now) }))
    .filter(({ info }) => info.status === 'available' || info.status === 'in_progress' || info.status === 'ready');
}

/** Quests a character at `level` would unlock on the way up from `fromLevel` (level range only; the quest is not "ready"). */
export function unlockedBetween(quests: Quest[], char: Pick<Character, 'progress'>, fromLevel: number, toLevel: number): { quest: Quest; level: number; needsPrerequisite: boolean }[] {
  return visibleQuests(quests)
    .filter((q) => q.minLevel !== null && q.minLevel > fromLevel && q.minLevel <= toLevel && !(q.repeatType === 'once' && isDelivered(char.progress[q.id])))
    .map((quest) => ({ quest, level: quest.minLevel as number, needsPrerequisite: quest.prerequisites.some((id) => !isDelivered(char.progress[id])) }))
    .sort((a, b) => a.level - b.level || a.quest.name.localeCompare(b.quest.name));
}
