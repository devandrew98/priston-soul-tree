// "Sugestão da Barra de Skill": the in-game hotkey bar (F1-F9 on top,
// 4-9 / 0 / - / = below) the player fills by dragging learned skills onto it.
import type { DragEvent } from 'react';
import { getSkillClass } from './classes';
import type { ClassSlug, Skill, SkillLevels } from './types';

export const SKILL_BAR_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', '4', '5', '6', '7', '8', '9', '0', '-', '='];

/** One skill id (or null) per key, in SKILL_BAR_KEYS order. */
export type SkillBar = (string | null)[];

export const emptySkillBar = (): SkillBar => SKILL_BAR_KEYS.map(() => null);

/** Passive skills can't go on the bar in-game, and only learned skills can. */
export function canPlaceOnBar(skill: Skill, skillLevels: SkillLevels): boolean {
  return skill.type !== 'passive' && (skillLevels[skill.id] ?? 0) > 0;
}

/** Drops whatever is no longer allowed (unlearned, passive, other class, duplicates). */
export function sanitizeSkillBar(classSlug: ClassSlug, skillLevels: SkillLevels, bar: SkillBar): SkillBar {
  const skills = new Map(getSkillClass(classSlug).tiers.flatMap((t) => t.skills).map((s) => [s.id, s]));
  const seen = new Set<string>();
  return SKILL_BAR_KEYS.map((_k, i) => {
    const id = bar[i];
    const skill = id ? skills.get(id) : undefined;
    if (!skill || seen.has(skill.id) || !canPlaceOnBar(skill, skillLevels)) return null;
    seen.add(skill.id);
    return skill.id;
  });
}

/** Puts a skill on `slot`. Dragged from another slot → the two swap; from the
 *  book → it moves there (each skill appears at most once). */
export function placeOnBar(bar: SkillBar, skillId: string, slot: number, fromSlot: number | null): SkillBar {
  const next = [...bar];
  if (fromSlot != null && fromSlot !== slot) {
    next[fromSlot] = next[slot];
  } else if (fromSlot == null) {
    const existing = next.indexOf(skillId);
    if (existing !== -1) next[existing] = null;
  }
  next[slot] = skillId;
  return next;
}

/** 1 char per key: the skill's index in its class (hex 0-f) or "." when empty. */
export function encodeSkillBar(classSlug: ClassSlug, bar: SkillBar): string {
  const skills = getSkillClass(classSlug).tiers.flatMap((t) => t.skills);
  const code = bar.map((id) => {
    const idx = id ? skills.findIndex((s) => s.id === id) : -1;
    return idx >= 0 && idx < 16 ? idx.toString(16) : '.';
  }).join('');
  return /[0-9a-f]/.test(code) ? code : '';
}

export function decodeSkillBar(classSlug: ClassSlug, code: string): SkillBar {
  const skills = getSkillClass(classSlug).tiers.flatMap((t) => t.skills);
  return SKILL_BAR_KEYS.map((_k, i) => {
    const idx = parseInt(code[i] ?? '.', 16);
    return Number.isNaN(idx) ? null : skills[idx]?.id ?? null;
  });
}

// Drag payload shared by the Skill Book (source) and the bar (source + target).
const DRAG_TYPE = 'application/x-pz-skill';

export function startSkillDrag(e: DragEvent, skillId: string, fromSlot: number | null, image?: Element | null): void {
  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ skillId, fromSlot }));
  e.dataTransfer.effectAllowed = 'move';
  if (image) e.dataTransfer.setDragImage(image, 16, 16);
}

export function isSkillDrag(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(DRAG_TYPE);
}

export function readSkillDrag(e: DragEvent): { skillId: string; fromSlot: number | null } | null {
  try {
    const data = JSON.parse(e.dataTransfer.getData(DRAG_TYPE));
    return typeof data?.skillId === 'string' ? { skillId: data.skillId, fromSlot: typeof data.fromSlot === 'number' ? data.fromSlot : null } : null;
  } catch {
    return null;
  }
}
