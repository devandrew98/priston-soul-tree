// The Quest Tracker splits the quest list in two tabs: the quests that give EXP (leveling) and the ones that give none
// (side quests, rank up, event steps, hand-ins...). The rule uses the registered EXP only, never the category name:
// EXP 0 is a real value meaning "gives no EXP"; an EXP not registered yet (null) stays with leveling so nothing is hidden by accident.
import type { Quest } from './types';

export type QuestGroup = 'leveling' | 'other';

export const questGroup = (q: Pick<Quest, 'baseExp'>): QuestGroup => (q.baseExp === 0 ? 'other' : 'leveling');
