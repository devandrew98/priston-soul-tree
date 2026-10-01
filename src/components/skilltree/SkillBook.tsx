// In-game "Skill Book" window: the original 800x200 artwork as the backdrop,
// with each skill's icon dropped into its hex slot and its level written in
// the twin bars beside it. Every position below is in that artwork's pixels.
import type { CSSProperties } from 'react';
import { getMaxAllowedSkillLevel } from '../../lib/skilltree/rules';
import { canPlaceOnBar, startSkillDrag } from '../../lib/skilltree/skillBar';
import type { Skill, SkillClass, SkillLevels } from '../../lib/skilltree/types';

const BOOK_W = 800;
const BOOK_H = 200;

/** Hex centers, in skill order: T1 1-4, T2 5-8, T3 9-12, T4 13-16. */
const SLOTS: [number, number][] = [
  [41, 126], [80, 169], [90, 89], [150, 99],
  [221, 89], [240, 140], [281, 89], [355, 89],
  [425, 99], [495, 79], [535, 130], [555, 79],
  [625, 104], [685, 135], [705, 84], [746, 135],
];

/** Where the remaining SP / EP numbers go (the blank lines after "SP" and "EP"). */
const SP_POS: [number, number] = [208, 182];
const EP_POS: [number, number] = [250, 182];

const at = (x: number, y: number): CSSProperties => ({ left: `${(x / BOOK_W) * 100}%`, top: `${(y / BOOK_H) * 100}%` });

export function SkillBook({
  cls, skillLevels, characterLevel, spLeft, epLeft, selectedId, onSelect, onStep, onMax,
}: {
  cls: SkillClass;
  skillLevels: SkillLevels;
  characterLevel: number;
  spLeft: number;
  epLeft: number;
  selectedId: string | null;
  onSelect: (skill: Skill) => void;
  onStep: (skill: Skill, delta: 1 | -1) => void;
  onMax: (skill: Skill) => void;
}) {
  const skills = cls.tiers.flatMap((t) => t.skills);

  return (
    <div className="sk-book-scroll">
      <div className="sk-book" role="group" aria-label="Skill Book">
        {skills.map((skill, i) => {
          const slot = SLOTS[i];
          if (!slot) return null;
          const lvl = skillLevels[skill.id] ?? 0;
          const locked = getMaxAllowedSkillLevel(skill, characterLevel) === 0;
          const maxed = lvl >= skill.maxLevel;
          const state = locked ? 'locked' : maxed ? 'maxed' : lvl > 0 ? 'invested' : 'empty';
          const digits = String(lvl).padStart(2, '0');
          return (
            <div key={skill.id} className={`sk-slot ${state}${selectedId === skill.id ? ' selected' : ''}`} style={at(slot[0], slot[1])}>
              <button
                type="button"
                className="sk-hex"
                title={skill.name}
                aria-label={`${skill.name} ${lvl}/${skill.maxLevel}`}
                onClick={(e) => { onSelect(skill); if (e.shiftKey) onMax(skill); else onStep(skill, 1); }}
                onContextMenu={(e) => { e.preventDefault(); onSelect(skill); onStep(skill, -1); }}
                draggable={canPlaceOnBar(skill, skillLevels)}
                onDragStart={(e) => startSkillDrag(e, skill.id, null, e.currentTarget.querySelector('img'))}
              >
                <img src={skill.icon} alt="" draggable={false} />
              </button>
              <span className="sk-bars" aria-hidden="true">
                <span>{digits[0]}</span>
                <span>{digits[1]}</span>
              </span>
            </div>
          );
        })}
        <b className={`sk-book-pts${spLeft > 0 ? ' left' : ''}`} style={at(...SP_POS)}>{spLeft}</b>
        <b className={`sk-book-pts${epLeft > 0 ? ' left' : ''}`} style={at(...EP_POS)}>{epLeft}</b>
      </div>
    </div>
  );
}
