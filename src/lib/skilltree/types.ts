// Domain types for the Skill Tree / Skill Builder tool.

export type ClassSlug =
  | 'fighter' | 'archer' | 'mechanician' | 'assassin' | 'pikeman'
  | 'knight' | 'shaman' | 'priestess' | 'magician' | 'atalanta';

export const CLASS_SLUGS: ClassSlug[] = [
  'fighter', 'archer', 'mechanician', 'assassin', 'pikeman',
  'knight', 'shaman', 'priestess', 'magician', 'atalanta',
];

export type SkillType = 'attack' | 'buff' | 'debuff' | 'passive' | 'healing' | 'summon';

export interface Skill {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  unlockLevel: number;
  maxLevel: number; // 10 for regular skills, 1 for the tier-4 Ultimate
  type: SkillType;
  description: string;
  icon: string;
  isPrimal: boolean; // first skill of tier 2 (flavor marker only, no rule attached)
  isUltimate: boolean; // last skill of tier 4 — single-rank capstone
}

export interface SkillTier {
  tier: 1 | 2 | 3 | 4;
  name: string; // the class's own title for this tier, e.g. "Saintess"
  skills: Skill[];
}

export interface SkillClass {
  slug: ClassSlug;
  name: string;
  tiers: SkillTier[];
}

/** A build: how many points are in each skill, by skill id. Missing = 0. */
export type SkillLevels = Record<string, number>;

export interface Build {
  classSlug: ClassSlug;
  level: number;
  questIds: string[]; // completed Skill Point quests
  skillLevels: SkillLevels;
}

export interface PointsSummary {
  used: number;
  available: number;
  total: number;
}
