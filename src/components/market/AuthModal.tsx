import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CLASSES, SELLERS } from '../../lib/market/data';
import { useI18n } from '../../lib/i18n';
import { useAuth } from './store';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { authErrMsg, maskEmail, sendPasswordReset, signIn, signInWithGoogle, signUp, updateAvatar, uploadToBucket } from '../../lib/market/auth';
import { squareThumbnail } from '../../lib/market/image';
import { refreshProfile } from './session';
import { Avatar, OnlineDot, RepBadge } from './parts';

const AVATARS = ['🧑', '🐺', '🦁', '🏹', '⚔️', '🛡️', '🔮', '🐉', '👑', '🌙', '🦅', '🗡️'];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { loginAs, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const fileRef = useRef<HTMLInputElement>(null);

  // shared / register fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [nick, setNick] = useState('');
  const [className, setClassName] = useState(CLASSES[0]);
  const [clan, setClan] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const goMode = (m: 'login' | 'register' | 'forgot') => { setMode(m); setError(''); setInfo(''); };

  const onAvatarFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };
  const customAvatar = /^data:/.test(avatar);

  // ---- demo (mock) actions ----
  const demoLogin = (id: string) => { loginAs(id); onClose(); };
  const demoRegister = () => {
    if (!nick.trim()) return;
    register({ nick: nick.trim(), className, clan: clan.trim(), avatar });
    onClose();
  };

  // ---- real (backend) actions ----
  const realLogin = async () => {
    setError(''); setBusy(true);
    try { await signIn(email, password); onClose(); }
    catch (e) { setError(authErrMsg(e)); }
    finally { setBusy(false); }
  };
  const realRegister = async () => {
    setError('');
    if (!email.trim() || password.length < 6 || !nick.trim()) { setError(t('mk.auth.err.fields')); return; }
    if (password !== password2) { setError(t('mk.auth.err.pwmatch')); return; }
    setBusy(true);
    try {
      const { needsConfirmation, userId } = await signUp({ email, password, nick, className, clan, avatar });
      if (!needsConfirmation && userId && avatarFile) {
        try {
          const square = await squareThumbnail(avatarFile, 256);
          const url = await uploadToBucket('avatars', userId, square);
          await updateAvatar(userId, url);
          refreshProfile();
        } catch { /* avatar optional — ignore upload failures */ }
      }
      if (needsConfirmation) setInfo(t('mk.auth.confirm'));
      else onClose();
    } catch (e) { setError(authErrMsg(e)); }
    finally { setBusy(false); }
  };
  const googleLogin = async () => {
    setError(''); setBusy(true);
    try { await signInWithGoogle(); /* redirects away */ }
    catch (e) { setError(authErrMsg(e)); setBusy(false); }
  };
  const sendReset = async () => {
    if (!email.trim()) return;
    setError(''); setBusy(true);
    try { await sendPasswordReset(email); setInfo(t('mk.auth.forgot.sent', { email: maskEmail(email.trim()) })); }
    catch (e) { setError(authErrMsg(e)); }
    finally { setBusy(false); }
  };

  const AvatarPicker = (
    <div className="mk-field">
      <span>{t('mk.auth.avatar')}</span>
      <div className="mk-avatar-pick">
        {AVATARS.map((a) => (
          <button key={a} className={`mk-avatar-opt ${avatar === a ? 'on' : ''}`} onClick={() => { setAvatar(a); setAvatarFile(null); }}>{a}</button>
        ))}
        <button className={`mk-avatar-opt upload ${customAvatar ? 'on' : ''}`} onClick={() => fileRef.current?.click()} title={t('mk.auth.uploadavatar')}>
          {customAvatar ? <Avatar value={avatar} /> : '📷'}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/bmp,image/jpeg,image/webp" hidden onChange={(e) => onAvatarFile(e.target.files?.[0])} />
      </div>
    </div>
  );

  return createPortal(
    <div className="mk-modal-backdrop" onClick={onClose}>
      <div className="mk-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mk-modal-close" onClick={onClose} aria-label={t('mk.close')}>✕</button>
        <h2 className="mk-modal-title">🏰 {t('mk.auth.welcome')}</h2>

        {mode !== 'forgot' && (
          <div className="mk-auth-tabs">
            <button className={mode === 'login' ? 'on' : ''} onClick={() => goMode('login')}>{t('mk.auth.login')}</button>
            <button className={mode === 'register' ? 'on' : ''} onClick={() => goMode('register')}>{t('mk.auth.register')}</button>
          </div>
        )}

        {info ? (
          <div className="mk-auth-info">📧 {info}</div>
        ) : BACKEND_ENABLED ? (
          mode === 'forgot' ? (
            <div className="mk-auth-register">
              <p className="mk-muted">{t('mk.auth.forgot.hint')}</p>
              <label className="mk-field">
                <span>{t('mk.auth.email')}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" onKeyDown={(e) => { if (e.key === 'Enter') sendReset(); }} />
              </label>
              {error && <p className="mk-auth-err">✕ {error}</p>}
              <button className="mk-btn primary mk-auth-submit" onClick={sendReset} disabled={busy || !email.trim()}>{busy ? '…' : `📧 ${t('mk.auth.forgot.send')}`}</button>
              <button className="mk-linkbtn" onClick={() => goMode('login')}>← {t('mk.auth.backlogin')}</button>
            </div>
          ) : (
            <div className="mk-auth-register">
              <button className="mk-google-btn" onClick={googleLogin} disabled={busy}><GoogleIcon /> {t('mk.auth.google')}</button>
              <div className="mk-auth-divider"><span>{t('mk.auth.or')}</span></div>

              <label className="mk-field">
                <span>{t('mk.auth.email')}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" />
              </label>
              <label className="mk-field">
                <span>{t('mk.auth.password')}</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onKeyDown={(e) => { if (e.key === 'Enter' && mode === 'login') realLogin(); }} />
              </label>

              {mode === 'register' && (
                <>
                  <label className="mk-field">
                    <span>{t('mk.auth.password2')}</span>
                    <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                  </label>
                  <label className="mk-field">
                    <span>{t('mk.auth.nick')}</span>
                    <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Ex.: DragonSlayer" maxLength={20} />
                  </label>
                  <div className="mk-auth-row">
                    <label className="mk-field">
                      <span>{t('mk.class')}</span>
                      <select value={className} onChange={(e) => setClassName(e.target.value)}>
                        {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="mk-field">
                      <span>{t('mk.auth.clan')}</span>
                      <input value={clan} onChange={(e) => setClan(e.target.value)} placeholder="—" maxLength={16} />
                    </label>
                  </div>
                  {AvatarPicker}
                </>
              )}

              {error && <p className="mk-auth-err">✕ {error}</p>}
              <button className="mk-btn primary mk-auth-submit" onClick={mode === 'login' ? realLogin : realRegister} disabled={busy}>
                {busy ? '…' : mode === 'login' ? t('mk.auth.login') : `✓ ${t('mk.auth.createaccount')}`}
              </button>
              {mode === 'login' && <button className="mk-linkbtn" onClick={() => goMode('forgot')}>{t('mk.auth.forgot')}</button>}
            </div>
          )
        ) : mode === 'login' ? (
          <div className="mk-auth-login">
            <p className="mk-muted">{t('mk.auth.pickchar')}</p>
            <div className="mk-auth-chars">
              {SELLERS.map((s) => (
                <button key={s.id} className="mk-auth-char" onClick={() => demoLogin(s.id)}>
                  <Avatar value={s.avatar} size="lg" />
                  <span className="mk-auth-char-info">
                    <b>{s.nick} {s.verified && <span className="mk-verified">✔</span>}</b>
                    <span className="mk-muted">{s.className} · {t('mk.lvl')} {s.level} <OnlineDot online={s.online} /></span>
                    <RepBadge seller={s} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mk-auth-register">
            <label className="mk-field">
              <span>{t('mk.auth.nick')}</span>
              <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Ex.: DragonSlayer" maxLength={20} />
            </label>
            <div className="mk-auth-row">
              <label className="mk-field">
                <span>{t('mk.class')}</span>
                <select value={className} onChange={(e) => setClassName(e.target.value)}>
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="mk-field">
                <span>{t('mk.auth.clan')}</span>
                <input value={clan} onChange={(e) => setClan(e.target.value)} placeholder="—" maxLength={16} />
              </label>
            </div>
            {AvatarPicker}
            <button className="mk-btn primary mk-auth-submit" onClick={demoRegister} disabled={!nick.trim()}>
              ✓ {t('mk.auth.createaccount')}
            </button>
            <p className="mk-muted mk-auth-note">{t('mk.auth.demonote')}</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
