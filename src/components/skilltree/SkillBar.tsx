import { useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { getSkill } from '../../lib/skilltree/classes';
import {
  SKILL_BAR_KEYS, canPlaceOnBar, isSkillDrag, placeOnBar, readSkillDrag, startSkillDrag, type SkillBar as Bar,
} from '../../lib/skilltree/skillBar';
import { renderSkillBarImage } from '../../lib/skilltree/exportImage';
import type { ClassSlug, Skill, SkillLevels } from '../../lib/skilltree/types';

const PER_ROW = 9;

/** "Sugestão da Barra de Skill" — drop targets for skills dragged from the Skill Book. */
export function SkillBar({
  bar, skillLevels, selectedSkill, exportInfo, onChange,
}: {
  bar: Bar;
  skillLevels: SkillLevels;
  selectedSkill: Skill | null; // tap-to-place fallback for touch screens
  exportInfo: { classSlug: ClassSlug; className: string; level: number; buildName: string }; // for the PNG export
  onChange: (update: (bar: Bar) => Bar) => void;
}) {
  const { t } = useI18n();
  const [over, setOver] = useState<number | null>(null);
  const droppedOnSlot = useRef(false);

  const clear = (slot: number) => onChange((cur) => cur.map((id, i) => (i === slot ? null : id)));
  const place = (skillId: string, slot: number, fromSlot: number | null) => {
    const skill = getSkill(skillId);
    if (skill && canPlaceOnBar(skill, skillLevels)) onChange((cur) => placeOnBar(cur, skillId, slot, fromSlot));
  };

  const rows = [SKILL_BAR_KEYS.slice(0, PER_ROW), SKILL_BAR_KEYS.slice(PER_ROW)];

  const [exportState, setExportState] = useState<'idle' | 'working' | 'copied' | 'fail'>('idle');
  const hasSkills = bar.some(Boolean);
  const makeImage = async () => renderSkillBarImage({ ...exportInfo, bar });
  const download = async () => {
    setExportState('working');
    const blob = await makeImage();
    if (!blob) { setExportState('fail'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barra-de-skills-${exportInfo.classSlug}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    setExportState('idle');
  };
  const copyImage = async () => {
    setExportState('working');
    const blob = await makeImage();
    try {
      if (!blob || !navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('unsupported');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setExportState('copied');
      window.setTimeout(() => setExportState('idle'), 2000);
    } catch {
      setExportState('fail');
    }
  };

  return (
    <section className="sk-bar-wrap">
      <h2 className="mk-h2">⌨ {t('sk.bar.title')}</h2>
      <p className="mk-muted sk-bar-sub">{t('sk.bar.hint')}</p>
      <div className="sk-bar-scroll">
        <div className="sk-bar">
          {rows.map((keys, r) => (
            <div key={r} className="sk-bar-row">
              {keys.map((key, k) => {
                const slot = r * PER_ROW + k;
                const skill = bar[slot] ? getSkill(bar[slot]!) : undefined;
                return (
                  <div
                    key={key}
                    className={`sk-bar-slot${over === slot ? ' over' : ''}${skill ? ' filled' : ''}`}
                    title={skill ? `${skill.name} — ${t('sk.bar.clear')}` : undefined}
                    onDragOver={(e) => { if (isSkillDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(slot); } }}
                    onDragLeave={() => setOver((cur) => (cur === slot ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOver(null);
                      droppedOnSlot.current = true;
                      const data = readSkillDrag(e);
                      if (data) place(data.skillId, slot, data.fromSlot);
                    }}
                    onClick={() => {
                      if (selectedSkill) place(selectedSkill.id, slot, null);
                    }}
                    onContextMenu={(e) => { e.preventDefault(); clear(slot); }}
                  >
                    {skill && (
                      <img
                        src={skill.icon}
                        alt={skill.name}
                        draggable
                        onDragStart={(e) => { droppedOnSlot.current = false; startSkillDrag(e, skill.id, slot, e.currentTarget); }}
                        // Dropped outside any slot → take it off the bar.
                        onDragEnd={() => { if (!droppedOnSlot.current) clear(slot); }}
                      />
                    )}
                    <span className="sk-bar-key">{key}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="sk-bar-actions">
        <button type="button" className="mk-btn sm" disabled={!hasSkills || exportState === 'working'} onClick={download}>⬇ {t('sk.bar.download')}</button>
        <button type="button" className="mk-btn sm" disabled={!hasSkills || exportState === 'working'} onClick={copyImage}>{exportState === 'copied' ? `✅ ${t('sk.bar.copied')}` : `📋 ${t('sk.bar.copyimg')}`}</button>
        {exportState === 'fail' && <span className="sk-bar-fail">{t('sk.bar.exportfail')}</span>}
      </div>
    </section>
  );
}
