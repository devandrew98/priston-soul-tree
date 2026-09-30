import { useI18n } from '../../lib/i18n';
import { getMaxAllowedSkillLevel, getRequiredCharacterLevel } from '../../lib/skilltree/rules';
import type { Skill } from '../../lib/skilltree/types';

export function SkillCard({
  skill, level, characterLevel, hasBudget, readOnly, onChange,
}: {
  skill: Skill;
  level: number;
  characterLevel: number;
  hasBudget: boolean; // at least 1 point left in this skill's pool (SP or EP)
  readOnly?: boolean;
  onChange?: (next: number) => void;
}) {
  const { t } = useI18n();
  const levelCap = getMaxAllowedSkillLevel(skill, characterLevel);
  const locked = characterLevel < skill.unlockLevel;
  const maxed = level >= skill.maxLevel;
  const canIncrease = !readOnly && !maxed && level < levelCap && hasBudget;
  const canDecrease = !readOnly && level > 0;
  const blockedByLevel = !maxed && level >= levelCap;
  const nextReqLevel = maxed ? null : getRequiredCharacterLevel(skill.unlockLevel, level + 1);

  const state = locked ? 'locked' : maxed ? 'maxed' : level > 0 ? 'invested' : 'available';

  const maximize = () => {
    if (readOnly || !onChange) return;
    onChange(levelCap);
  };

  return (
    <div className={`sk-card ${state}`} onContextMenu={(e) => { e.preventDefault(); maximize(); }}>
      <div className="sk-card-top">
        <img src={skill.icon} alt={skill.name} className="sk-card-icon" />
        {skill.isPrimal && <span className="sk-tag primal">PRIMAL</span>}
        {skill.isUltimate && <span className="sk-tag ultimate">ULTIMATE</span>}
      </div>
      <b className="sk-card-name">{skill.name}</b>
      <span className="sk-card-unlock">{t('sk.unlock')} Lv.{skill.unlockLevel}</span>

      {!readOnly && (
        <div className="sk-card-controls">
          <button type="button" className="sk-stepper" disabled={!canDecrease} onClick={() => onChange?.(level - 1)}>−</button>
          <span className="sk-card-count">{level} / {skill.maxLevel}</span>
          <button type="button" className="sk-stepper" disabled={!canIncrease} onClick={() => onChange?.(level + 1)}>+</button>
        </div>
      )}
      {readOnly && level > 0 && <span className="sk-card-count">{level} / {skill.maxLevel}</span>}

      {!readOnly && <button type="button" className="sk-maxbtn" onClick={maximize} disabled={maxed || levelCap === 0} title={t('sk.maximize')}>⤒ {t('sk.max.btn')}</button>}

      <div className="sk-tooltip">
        <b>{skill.name}</b>
        <span>{t('sk.tier')} {skill.tier} · {t('sk.unlock')} Lv.{skill.unlockLevel}</span>
        <span>{t('sk.current')}: {level}/{skill.maxLevel}</span>
        {nextReqLevel != null && <span>{t('sk.nextreq')}: Lv.{nextReqLevel}</span>}
        {locked && <span className="sk-tooltip-warn">{t('sk.locked.hint', { level: skill.unlockLevel })}</span>}
        {!locked && blockedByLevel && <span className="sk-tooltip-warn">{t('sk.requireslevel', { level: getRequiredCharacterLevel(skill.unlockLevel, level + 1) })}</span>}
        <p>{skill.description}</p>
      </div>
    </div>
  );
}
