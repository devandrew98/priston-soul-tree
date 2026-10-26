import { useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { getSkill } from '../../lib/skilltree/classes';
import { buildLevelPlan, groupPlan, type PlanPriority } from '../../lib/skilltree/plan';
import type { ClassSlug, SkillLevels } from '../../lib/skilltree/types';

/** "Plano de pontos por nível": in which order to spend the points to end up with this build. */
export function SkillPlan({ classSlug, skillLevels, level }: { classSlug: ClassSlug; skillLevels: SkillLevels; level: number }) {
  const { t } = useI18n();
  const [priority, setPriority] = useState<PlanPriority>('order');
  const [copied, setCopied] = useState(false);

  const plan = useMemo(() => buildLevelPlan(classSlug, skillLevels, priority, level), [classSlug, skillLevels, priority, level]);
  const rows = useMemo(() => groupPlan(plan.steps), [plan]);

  const planText = () => rows.map((row) => {
    const head = row.level === null ? t('sk.plan.quests') : `${t('sk.level')} ${row.level}`;
    const parts = row.items.map((i) => `${getSkill(i.skillId)?.name ?? i.skillId} +${i.points} (${i.rank})${i.elite ? ' EP' : ''}`);
    return `${head}: ${parts.join(', ')}`;
  }).join('\n');

  const copy = () => {
    navigator.clipboard?.writeText(planText());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <details className="sk-plan">
      <summary>📅 {t('sk.plan.title')}</summary>
      <p className="mk-muted sk-plan-hint">{t('sk.plan.hint')}</p>
      <div className="sk-plan-tools">
        <label className="mk-field">
          <span>{t('sk.plan.priority')}</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value as PlanPriority)}>
            <option value="order">{t('sk.plan.order')}</option>
            <option value="spread">{t('sk.plan.spread')}</option>
          </select>
        </label>
        <button type="button" className="mk-btn sm" disabled={rows.length === 0} onClick={copy}>{copied ? `✅ ${t('sk.plan.copied')}` : `📋 ${t('sk.plan.copy')}`}</button>
      </div>

      {rows.length === 0 ? <p className="mk-muted">{t('sk.plan.empty')}</p> : (
        <ol className="sk-plan-list">
          {rows.map((row) => (
            <li key={row.level ?? 'quests'} className="sk-plan-row">
              <span className="sk-plan-level">{row.level === null ? t('sk.plan.quests') : `${t('sk.level')} ${row.level}`}</span>
              <span className="sk-plan-items">
                {row.items.map((i) => {
                  const skill = getSkill(i.skillId);
                  return (
                    <span key={i.skillId} className={`sk-plan-item${i.elite ? ' elite' : ''}`} title={skill?.name}>
                      {skill && <img src={skill.icon} alt="" />}
                      <b>{skill?.name ?? i.skillId}</b>
                      <em>+{i.points} → {i.rank}{i.elite ? ' · EP' : ''}</em>
                    </span>
                  );
                })}
              </span>
            </li>
          ))}
        </ol>
      )}
      {(plan.unspentSp > 0 || plan.unspentEp > 0) && (
        <p className="mk-muted sk-plan-hint">{t('sk.plan.unspent', { sp: plan.unspentSp, ep: plan.unspentEp, level })}</p>
      )}
    </details>
  );
}
