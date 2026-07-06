import { useI18n } from '../../lib/i18n';

export function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mk-loginprompt">
      <span className="mk-loginprompt-ic">🔒</span>
      <h2>{t('mk.auth.required')}</h2>
      <p className="mk-muted">{t('mk.auth.requiredsub')}</p>
      <button className="mk-btn primary" onClick={onLogin}>{t('mk.auth.login')}</button>
    </div>
  );
}
