// Quest Tracker: shared types. Everything official (quests, EXP table, bonuses) is data supplied by the administrator;
// nothing in the code assumes a game value.

export type RepeatType = 'once' | 'repeatable' | 'daily' | 'interval';
export const REPEAT_TYPES: RepeatType[] = ['once', 'repeatable', 'daily', 'interval'];

export type ObjectiveKind = 'monster' | 'boss' | 'item' | 'other';
export const OBJECTIVE_KINDS: ObjectiveKind[] = ['monster', 'boss', 'item', 'other'];
export interface Objective { kind: ObjectiveKind; name: string; qty: number | null }

export interface QuestCategory { id: string; name: string; sort: number; color: string; active: boolean; builtin: boolean }

export interface Quest {
  id: string;
  name: string;
  categoryId: string;
  minLevel: number | null;
  maxLevel: number | null;
  map: string;
  npc: string;
  description: string;
  objectives: Objective[];
  /** Absolute base EXP of the reward; null when the administrator has not registered it yet. */
  baseExp: number | null;
  /** Typical Grind EXP (killing mobs) while doing the quest, measured in game by the administrator. Shown apart, never part of the calculations. */
  grindExp?: number | null;
  prerequisites: string[];
  repeatType: RepeatType;
  /** Hours between two deliveries ('interval'); 'daily' is 24h. */
  repeatIntervalHours: number | null;
  active: boolean;
  /** Logical delete: hidden everywhere but kept so character histories never point to nothing. */
  archived: boolean;
}

/**
 * How the official EXP table is written:
 * - per_level: the value of level L is the EXP needed to go from level L to L+1;
 * - cumulative_start: the value of level L is the total EXP accumulated when reaching level L;
 * - cumulative_end: the value of level L is the total EXP accumulated when completing level L.
 */
export type ExpTableMode = 'per_level' | 'cumulative_start' | 'cumulative_end';
export const EXP_TABLE_MODES: ExpTableMode[] = ['per_level', 'cumulative_start', 'cumulative_end'];
export interface ExpLevel { level: number; value: number; active: boolean }

/** How several bonuses combine: additive = base x (1 + sum), multiplicative = base x product of (1 + each). */
export type CombineMode = 'additive' | 'multiplicative';
export type RoundingMode = 'floor' | 'round' | 'ceil';

/** Game rules that still need confirmation: both are OFF by default and only used if the administrator turns them on. */
export interface QuestRules {
  /** A quest never gives more than this % of the EXP of the level the character is at when delivering. null = no limit. */
  capPercentPerQuest: number | null;
  /** What happens with the EXP above the level-up point: carried to the next level, or lost. */
  overflow: 'carry' | 'lose';
}

export interface QuestSettings {
  expTableMode: ExpTableMode;
  combineMode: CombineMode;
  rounding: RoundingMode;
  rules: QuestRules;
  /** Bumped by the database every time the official data changes (saved plans compare it to know they are outdated). */
  dataVersion: number;
}

export interface ExpBonus {
  id: string;
  name: string;
  /** toggle: on/off with the administrator's percentage; manual: each player types their own percentage (Soul Tree). */
  kind: 'toggle' | 'manual';
  percent: number;
  enabled: boolean;
  /** Category ids the bonus applies to; empty = every category. */
  appliesTo: string[];
  sort: number;
  builtin: boolean;
}

export type QuestStatus = 'locked' | 'available' | 'in_progress' | 'ready' | 'completed';
export const STORED_STATUSES = ['in_progress', 'ready', 'completed'] as const;
export type StoredStatus = (typeof STORED_STATUSES)[number];
export interface QuestProgress { status: StoredStatus; /** Delivery times (ms), oldest first. */ deliveries: number[]; updatedAt: number }

export interface BonusChoice { on: boolean; percent?: number }

export interface PlanTarget { level: number; pct: number }
export interface SavedPlan {
  id: string;
  name: string;
  questIds: string[];
  target: PlanTarget;
  /** QuestSettings.dataVersion the plan was last calculated with. */
  dataVersion: number;
  createdAt: number;
  /** Short result shown in the list (so an outdated plan still shows what it said). */
  summary: { finalLevel: number; finalPct: number; preGainExp: number | null } | null;
}

export interface Character {
  id: string;
  name: string;
  level: number;
  /** The percentage the player typed (source of truth); the absolute EXP is worked out from the official table. */
  expPct: number;
  bonuses: Record<string, BonusChoice>;
  progress: Record<string, QuestProgress>;
  plans: SavedPlan[];
  updatedAt: number;
}

export interface QuestData {
  categories: QuestCategory[];
  quests: Quest[];
  expLevels: ExpLevel[];
  bonuses: ExpBonus[];
  settings: QuestSettings;
}

export const DEFAULT_SETTINGS: QuestSettings = {
  expTableMode: 'per_level',
  combineMode: 'additive',
  rounding: 'floor',
  rules: { capPercentPerQuest: null, overflow: 'carry' },
  dataVersion: 0,
};
