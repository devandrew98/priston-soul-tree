import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CLASSES, SELLERS } from '../../lib/market/data';
import { useI18n } from '../../lib/i18n';
import { useAuth } from './store';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { signIn, signUp, updateAvatar, uploadToBucket } from '../../lib/market/auth';
import { squareThumbnail } from '../../lib/market/image';
import { refreshProfile } from './session';
import { Avatar, OnlineDot, RepBadge } from './parts';

const AVATARS = ['🧑', '🐺', '🦁', '🏹', '⚔️', '🛡️', '🔮', '🐉', '👑', '🌙', '🦅', '🗡️'];

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { loginAs, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const fileRef = useRef<HTMLInputElement>(null);

  // shared / register fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState('');
  const [className, setClassName] = useState(CLASSES[0]);
  const [clan, setClan] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

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
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };
  const realRegister = async () => {
    setError('');
    if (!email.trim() || password.length < 6 || !nick.trim()) { setError(t('mk.auth.err.fields')); return; }
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
    } catch (e) { setError(errMsg(e)); }
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

        <div className="mk-auth-tabs">
          <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setError(''); setInfo(''); }}>{t('mk.auth.login')}</button>
          <button className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setError(''); setInfo(''); }}>{t('mk.auth.register')}</button>
        </div>

        {info ? (
          <div className="mk-auth-info">📧 {info}</div>
        ) : BACKEND_ENABLED ? (
          <div className="mk-auth-register">
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
          </div>
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

function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered|already exists|duplicate/i.test(m)) return 'Este e-mail já está cadastrado.';
  if (/password should be at least/i.test(m)) return 'A senha deve ter no mínimo 6 caracteres.';
  return m;
}
