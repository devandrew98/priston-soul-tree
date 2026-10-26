import { useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { compareBuilds, parseShareLink, type ComparableBuild } from '../../lib/skilltree/compare';
import type { ClassSlug, SkillLevels } from '../../lib/skilltree/types';

/** Paste another build's share link to see, skill by skill, how it differs from the one on screen. */
export function SkillCompare({ classSlug, level, skillLevels, buildName }: { classSlug: ClassSlug; level: number; skillLevels: SkillLevels; buildName: string }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [other, setOther] = useState<ComparableBuild | null>(null);
  const [invalid, setInvalid] = useState(false);

  const current: ComparableBuild = useMemo(() => ({ classSlug, level, skillLevels, name: buildName }), [classSlug, level, skillLevels, buildName]);
  const result = useMemo(() => (other ? compareBuilds(current, other) : null), [current, other]);

  const run = () => {
    const parsed = parseShareLink(text);
    setInvalid(!parsed);
    setOther(parsed);
  };

  return (
    <details className="sk-compare">
      <summary>⚖ {t('sk.cmp.title')}</summary>
      <p className="mk-muted sk-plan-hint">{t('sk.cmp.hint')}</p>
      <div className="sk-compare-input">
        <input
          type="text"
          value={text}
          placeholder={t('sk.cmp.placeholder')}
          autoComplete="off"
          name="skill-compare-link"
          data-1p-ignore
          data-lpignore="true"
          onChange={(e) => { setText(e.target.value); setInvalid(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
        />
        <button type="button" className="mk-btn sm primary" disabled={!text.trim()} onClick={run}>{t('sk.cmp.go')}</button>
      </div>
      {invalid && <p className="sk-notice">{t('sk.cmp.invalid')}</p>}

      {other && result && !result.sameClass && <p className="sk-notice">{t('sk.cmp.diffclass')}</p>}
      {other && result && result.sameClass && (
        <div className="sk-compare-result">
          <p className="mk-muted">
            {result.differing === 0 ? t('sk.cmp.same') : t('sk.cmp.summary', { n: result.differing })}
            {' · '}{t('sk.level')}: {current.level} / {other.level}
          </p>
          <table className="sk-compare-table">
            <thead>
              <tr>
                <th>{t('sk.cmp.skill')}</th>
                <th>{buildName.trim() || t('sk.cmp.current')}</th>
                <th>{other.name || t('sk.cmp.other')}</th>
                <th aria-label={t('sk.cmp.diff')}>±</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.skill.id} className={r.delta > 0 ? 'more' : r.delta < 0 ? 'less' : ''}>
                  <td><img src={r.skill.icon} alt="" />{r.skill.name}</td>
                  <td>{r.a}</td>
                  <td>{r.b}</td>
                  <td>{r.delta === 0 ? '·' : r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{t('sk.cmp.points')}</td>
                <td>{result.a.sp} SP · {result.a.ep} EP</td>
                <td>{result.b.sp} SP · {result.b.ep} EP</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </details>
  );
}
