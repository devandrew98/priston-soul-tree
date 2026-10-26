import { useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { requestLogin } from '../../lib/builds/account';
import { BUILD_NAME_MAX, BuildsUnavailableError, cleanBuildName, getBuildsRepo, type BuildKind } from '../../lib/builds/userBuilds';
import type { ClassSlug } from '../../lib/skilltree/types';
import { TOOL_PATHS } from '../../lib/routes';
import { useBuildsAccount } from './useBuildsAccount';

/** "Save to my account" — a small button + form used by the Skill Builder and the Soul Tree. */
export function SaveBuild({
  kind, defaultName, classSlug, level, empty, getPayload,
}: {
  kind: BuildKind;
  defaultName: string;
  classSlug?: ClassSlug;
  level?: number;
  empty: boolean; // nothing to save yet
  getPayload: () => { payload: string; summary: string };
}) {
  const { t } = useI18n();
  const { loggedIn } = useBuildsAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'unavailable' | 'fail'>('idle');

  const start = () => {
    if (!loggedIn) { requestLogin(); return; }
    setName(cleanBuildName(defaultName));
    setState('idle');
    setOpen(true);
  };

  const save = async () => {
    setState('saving');
    try {
      const { payload, summary } = getPayload();
      await getBuildsRepo().save({ kind, name: cleanBuildName(name) || t('bd.untitled'), classSlug, level, payload, summary, isPublic });
      setState('saved');
    } catch (e) {
      setState(e instanceof BuildsUnavailableError ? 'unavailable' : 'fail');
    }
  };

  if (!open) {
    return (
      <button type="button" className="mk-btn" disabled={empty} onClick={start} title={empty ? t('bd.save.empty') : t('bd.save.title')}>
        💾 {t('bd.save.btn')}
      </button>
    );
  }

  return (
    <div className="bd-save sr-card">
      {state === 'saved' ? (
        <>
          <p className="mk-muted">✅ {t('bd.save.done')} {isPublic ? t('bd.save.done.public') : t('bd.save.done.private')}</p>
          <div className="sk-actions">
            <a className="mk-btn" href={TOOL_PATHS.builds}>{t('bd.save.see')}</a>
            <button type="button" className="mk-btn" onClick={() => setOpen(false)}>{t('sc.report.close')}</button>
          </div>
        </>
      ) : (
        <>
          <label className="mk-field">
            <span>{t('bd.save.name')}</span>
            <input type="text" value={name} maxLength={BUILD_NAME_MAX} autoComplete="off" name="saved-build-name" data-1p-ignore data-lpignore="true" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="sr-check">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            {t('bd.save.public')}
          </label>
          {state === 'unavailable' && <p className="sk-notice">{t('bd.unavailable')}</p>}
          {state === 'fail' && <p className="sk-notice">{t('bd.save.fail')}</p>}
          <div className="sk-actions">
            <button type="button" className="mk-btn primary" disabled={state === 'saving'} onClick={save}>💾 {t('bd.save.go')}</button>
            <button type="button" className="mk-btn" onClick={() => setOpen(false)}>{t('sc.report.close')}</button>
          </div>
        </>
      )}
    </div>
  );
}
