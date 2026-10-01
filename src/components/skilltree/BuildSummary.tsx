import { useI18n } from '../../lib/i18n';
import { SKILL_POINT_QUESTS } from '../../lib/skilltree/config';
import type { ClassSlug, SkillClass, SkillLevels } from '../../lib/skilltree/types';
import { classIcon } from './classIcon';

export function BuildSummary({
  classSlug, buildName, className, level, skillPoints, elitePoints, questIds, cls, skillLevels,
}: {
  classSlug: ClassSlug;
  buildName?: string;
  className: string;
  level: number;
  skillPoints: { used: number; total: number };
  elitePoints: { used: number; total: number };
  questIds: string[];
  cls: SkillClass;
  skillLevels: SkillLevels;
}) {
  const { t } = useI18n();
  const invested = cls.tiers
    .flatMap((tier) => tier.skills.map((s) => ({ skill: s, level: skillLevels[s.id] ?? 0, tier: tier.tier })))
    .filter((x) => x.level > 0);

  return (
    <section className="sk-summary">
      <h2 className="mk-h2">📋 {buildName ? buildName : t('sk.summary.title')}</h2>
      <div className="sk-summary-head">
        <img src={classIcon(classSlug)} alt="" className="sk-class-icon" />
        <b>{className} — {t('sk.level')} {level}</b>
      </div>
      <div className="sk-summary-points">
        <span>{t('sk.points.skill')}: <b>{skillPoints.used} / {skillPoints.total}</b></span>
        <span>{t('sk.points.elite')}: <b>{elitePoints.used} / {elitePoints.total}</b></span>
      </div>
      <div className="sk-summary-quests">
        {SKILL_POINT_QUESTS.map((q) => (
          <span key={q.id} className={questIds.includes(q.id) ? 'done' : 'pending'}>
            {questIds.includes(q.id) ? '✓' : '✕'} {t(q.nameKey)}
          </span>
        ))}
      </div>
      {invested.length === 0 ? (
        <p className="mk-muted">{t('sk.summary.empty')}</p>
      ) : (
        <div className="sk-summary-grid">
          {invested.map(({ skill, level: lvl }) => (
            <div key={skill.id} className="sk-summary-item">
              <img src={skill.icon} alt={skill.name} />
              <span>{skill.name}</span>
              <b>{lvl}/{skill.maxLevel}</b>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
