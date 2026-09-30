// Skill data catalog — loaded from src/data/skillClasses.json, scraped from
// the official pristontale.eu/characters/<class> pages (names, tiers, unlock
// levels, types, descriptions and icons are never invented — see the fetch/
// parse notes in supabase-less form here since this tool has no backend).
import raw from '../../data/skillClasses.json';
import { CLASS_SLUGS, type ClassSlug, type Skill, type SkillClass } from './types';

const DATA = raw as unknown as Record<ClassSlug, SkillClass>;

export function getSkillClass(slug: ClassSlug): SkillClass {
  return DATA[slug];
}

export const ALL_CLASSES: SkillClass[] = CLASS_SLUGS.map((s) => DATA[s]);

export function isClassSlug(value: string): value is ClassSlug {
  return (CLASS_SLUGS as string[]).includes(value);
}

const SKILL_BY_ID = new Map<string, Skill>();
for (const cls of ALL_CLASSES) {
  for (const tier of cls.tiers) {
    for (const skill of tier.skills) SKILL_BY_ID.set(skill.id, skill);
  }
}

export function getSkill(id: string): Skill | undefined {
  return SKILL_BY_ID.get(id);
}
