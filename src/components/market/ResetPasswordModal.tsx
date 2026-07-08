// Shown when the user returns via a password-reset email link (session in
// recovery mode). Lets them set a new password, then drops them in logged-in.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../lib/i18n';
import { updatePassword } from '../../lib/market/auth';
import { clearRecovery, useSession } from './session';

export function ResetPasswordModal() {
  const { t } = useI18n();
  const { recovery } = useSession();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!recovery) return null;

  const submit = async () => {
    setError('');
    if (pw.length < 6) { setError(t('mk.auth.err.pwshort')); return; }
    if (pw !== pw2) { setError(t('mk.auth.err.pwmatch')); return; }
    setBusy(true);
    try { await updatePassword(pw); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="mk-modal-backdrop">
      <div className="mk-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="mk-modal-title">🔑 {t('mk.auth.reset.title')}</h2>
        {done ? (
          <>
            <div className="mk-auth-info">✅ {t('mk.auth.reset.done')}</div>
            <button className="mk-btn primary mk-auth-submit" onClick={clearRecovery}>{t('mk.auth.reset.continue')}</button>
          </>
        ) : (
          <div className="mk-auth-register">
            <p className="mk-muted">{t('mk.auth.reset.hint')}</p>
            <label className="mk-field">
              <span>{t('mk.auth.reset.new')}</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </label>
            <label className="mk-field">
              <span>{t('mk.auth.password2')}</span>
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" autoComplete="new-password" onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
            </label>
            {error && <p className="mk-auth-err">✕ {error}</p>}
            <button className="mk-btn primary mk-auth-submit" onClick={submit} disabled={busy}>{busy ? '…' : `✓ ${t('mk.auth.reset.save')}`}</button>
            <button className="mk-linkbtn" onClick={clearRecovery}>{t('mk.cancel')}</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
