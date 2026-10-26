// Compare two skill builds of the same class, side by side.
import { decodeBuild } from './buildCode';
import { getSkillClass, isClassSlug } from './classes';
import { splitUsedPoints, validateBuild } from './rules';
import type { ClassSlug, Skill, SkillLevels } from './types';

export interface ComparableBuild {
  classSlug: ClassSlug;
  level: number;
  skillLevels: SkillLevels;
  name?: string;
}

/**
 * Reads a shared build link (".../skill-tree/<class>?level=120&build=...&name=..."), as produced by
 * "Compartilhar Build". The link is untrusted input, so it goes through validateBuild like everything else.
 * Returns null when the text isn't such a link.
 */
export function parseShareLink(text: string): ComparableBuild | null {
  const raw = text.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw, 'https://pristonzone.local');
  } catch {
    return null;
  }
  const match = url.pathname.match(/\/skill-tree\/([a-z]+)\/?$/i);
  const slug = match?.[1]?.toLowerCase();
  const encoded = url.searchParams.get('build');
  if (!slug || !isClassSlug(slug) || !encoded) return null;
  const { questIds, skillLevels } = decodeBuild(slug, encoded);
  const level = Number(url.searchParams.get('level')) || 1;
  const valid = validateBuild({ classSlug: slug, level, questIds, skillLevels });
  return { classSlug: valid.classSlug, level: valid.level, skillLevels: valid.skillLevels, name: (url.searchParams.get('name') ?? '').trim().slice(0, 40) };
}

export interface CompareRow {
  skill: Skill;
  a: number;
  b: number;
  delta: number; // b - a
}

export interface Comparison {
  sameClass: boolean;
  rows: CompareRow[]; // only skills where at least one build has points, in skill order
  differing: number;
  a: { sp: number; ep: number };
  b: { sp: number; ep: number };
}

export function compareBuilds(a: ComparableBuild, b: ComparableBuild): Comparison {
  const sameClass = a.classSlug === b.classSlug;
  const totals = (x: ComparableBuild) => {
    const u = splitUsedPoints(x.classSlug, x.skillLevels);
    return { sp: u.skillPointsUsed, ep: u.elitePointsUsed };
  };
  if (!sameClass) return { sameClass, rows: [], differing: 0, a: totals(a), b: totals(b) };

  const rows: CompareRow[] = [];
  for (const skill of getSkillClass(a.classSlug).tiers.flatMap((t) => t.skills)) {
    const la = a.skillLevels[skill.id] ?? 0;
    const lb = b.skillLevels[skill.id] ?? 0;
    if (la > 0 || lb > 0) rows.push({ skill, a: la, b: lb, delta: lb - la });
  }
  return { sameClass, rows, differing: rows.filter((r) => r.delta !== 0).length, a: totals(a), b: totals(b) };
}
