import { useI18n } from '../../lib/i18n';
import { getMaxAllowedSkillLevel, getRequiredCharacterLevel } from '../../lib/skilltree/rules';
import type { Skill } from '../../lib/skilltree/types';

/** Info + controls for the skill picked in the Skill Book (also the touch-friendly way to edit it). */
export function SkillDetail({
  skill, level, characterLevel, hasBudget, onChange,
}: {
  skill: Skill;
  level: number;
  characterLevel: number;
  hasBudget: boolean; // at least 1 point left in this skill's pool (SP or EP)
  onChange: (next: number) => void;
}) {
  const { t } = useI18n();
  const levelCap = getMaxAllowedSkillLevel(skill, characterLevel);
  const locked = characterLevel < skill.unlockLevel;
  const maxed = level >= skill.maxLevel;
  const canIncrease = !maxed && level < levelCap && hasBudget;
  const blockedByLevel = !maxed && level >= levelCap;
  const nextReqLevel = maxed ? null : getRequiredCharacterLevel(skill.unlockLevel, level + 1);

  return (
    <div className="sk-detail">
      <img src={skill.icon} alt="" className="sk-detail-icon" />
      <div className="sk-detail-info">
        <div className="sk-detail-title">
          <b>{skill.name}</b>
          {skill.isPrimal && <span className="sk-tag primal">PRIMAL</span>}
          {skill.isUltimate && <span className="sk-tag ultimate">ULTIMATE</span>}
        </div>
        <span className="sk-detail-meta">
          {t('sk.tier')} {skill.tier} · {t('sk.unlock')} Lv.{skill.unlockLevel}
          {nextReqLevel != null && <> · {t('sk.nextreq')}: Lv.{nextReqLevel}</>}
        </span>
        {locked && <span className="sk-detail-warn">{t('sk.locked.hint', { level: skill.unlockLevel })}</span>}
        {!locked && blockedByLevel && <span className="sk-detail-warn">{t('sk.requireslevel', { level: getRequiredCharacterLevel(skill.unlockLevel, level + 1) })}</span>}
        <p>{skill.description}</p>
      </div>
      <div className="sk-detail-controls">
        <div className="sk-card-controls">
          <button type="button" className="sk-stepper" disabled={level <= 0} onClick={() => onChange(level - 1)}>−</button>
          <span className="sk-card-count">{level} / {skill.maxLevel}</span>
          <button type="button" className="sk-stepper" disabled={!canIncrease} onClick={() => onChange(level + 1)}>+</button>
        </div>
        <button type="button" className="sk-maxbtn" onClick={() => onChange(levelCap)} disabled={maxed || levelCap === 0 || level >= levelCap} title={t('sk.maximize')}>⤒ {t('sk.max.btn')}</button>
      </div>
    </div>
  );
}
