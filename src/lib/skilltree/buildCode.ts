// Compact build encoding for the shareable link + a short human-readable
// "Build Code". The URL is never trusted as-is — whatever comes out of
// decodeBuild() below still goes through validateBuild()/sanitizeBuild()
// before it touches the UI (see rules.ts).
import { SKILL_POINT_QUESTS } from './config';
import { getSkillClass } from './classes';
import type { ClassSlug, SkillLevels } from './types';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  const bin = atob(padded + '='.repeat(pad));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/** 1 byte of quest bitmask + 4 bits per skill (levels 0-10 fit in 4 bits), 2 skills per byte. */
export function encodeBuild(classSlug: ClassSlug, questIds: string[], skillLevels: SkillLevels): string {
  const skills = getSkillClass(classSlug).tiers.flatMap((t) => t.skills);
  const questBits = SKILL_POINT_QUESTS.reduce((mask, q, i) => mask | (questIds.includes(q.id) ? (1 << i) : 0), 0);
  const bytes = new Uint8Array(1 + Math.ceil(skills.length / 2));
  bytes[0] = questBits;
  for (let i = 0; i < skills.length; i += 2) {
    const a = Math.max(0, Math.min(15, skillLevels[skills[i].id] ?? 0));
    const b = i + 1 < skills.length ? Math.max(0, Math.min(15, skillLevels[skills[i + 1].id] ?? 0)) : 0;
    bytes[1 + i / 2] = (a << 4) | b;
  }
  return toBase64Url(bytes);
}

export function decodeBuild(classSlug: ClassSlug, encoded: string): { questIds: string[]; skillLevels: SkillLevels } {
  try {
    const skills = getSkillClass(classSlug).tiers.flatMap((t) => t.skills);
    const bytes = fromBase64Url(encoded);
    const questBits = bytes[0] ?? 0;
    const questIds = SKILL_POINT_QUESTS.filter((_q, i) => (questBits & (1 << i)) !== 0).map((q) => q.id);
    const skillLevels: SkillLevels = {};
    for (let i = 0; i < skills.length; i++) {
      const byte = bytes[1 + Math.floor(i / 2)] ?? 0;
      const val = i % 2 === 0 ? byte >> 4 : byte & 0xf;
      if (val > 0) skillLevels[skills[i].id] = val;
    }
    return { questIds, skillLevels };
  } catch {
    return { questIds: [], skillLevels: {} };
  }
}

/** Short display code, e.g. "PRI-120-A7K3M2Q1" — derived from the same
 *  encoded string, not a separate stored identifier (see tool spec §12). */
export function buildDisplayCode(classSlug: ClassSlug, level: number, encoded: string): string {
  const abbr = classSlug.slice(0, 3).toUpperCase();
  const short = encoded.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || '0';
  return `${abbr}-${level}-${short}`;
}

export function buildShareUrl(classSlug: ClassSlug, level: number, questIds: string[], skillLevels: SkillLevels, buildName?: string, barCode?: string): string {
  const encoded = encodeBuild(classSlug, questIds, skillLevels);
  const params = new URLSearchParams({ level: String(level), build: encoded });
  const trimmedName = buildName?.trim();
  if (trimmedName) params.set('name', trimmedName);
  if (barCode) params.set('bar', barCode);
  return `${location.origin}/skill-tree/${classSlug}?${params.toString()}`;
}
