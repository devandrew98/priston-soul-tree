import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CLASSES, SELLERS } from '../../lib/market/data';
import { useI18n } from '../../lib/i18n';
import { useAuth } from './store';
import { OnlineDot, RepBadge } from './parts';

const AVATARS = ['🧑', '🐺', '🦁', '🏹', '⚔️', '🛡️', '🔮', '🐉', '👑', '🌙', '🦅', '🗡️'];

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { loginAs, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // register fields
  const [nick, setNick] = useState('');
  const [className, setClassName] = useState(CLASSES[0]);
  const [clan, setClan] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  const doLogin = (id: string) => { loginAs(id); onClose(); };
  const doRegister = () => {
    if (!nick.trim()) return;
    register({ nick: nick.trim(), className, clan: clan.trim(), avatar });
    onClose();
  };

  return createPortal(
    <div className="mk-modal-backdrop" onClick={onClose}>
      <div className="mk-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mk-modal-close" onClick={onClose} aria-label={t('mk.close')}>✕</button>
        <h2 className="mk-modal-title">🏰 {t('mk.auth.welcome')}</h2>

        <div className="mk-auth-tabs">
          <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>{t('mk.auth.login')}</button>
          <button className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>{t('mk.auth.register')}</button>
        </div>

        {mode === 'login' ? (
          <div className="mk-auth-login">
            <p className="mk-muted">{t('mk.auth.pickchar')}</p>
            <div className="mk-auth-chars">
              {SELLERS.map((s) => (
                <button key={s.id} className="mk-auth-char" onClick={() => doLogin(s.id)}>
                  <span className="mk-av lg">{s.avatar}</span>
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
            <div className="mk-field">
              <span>{t('mk.auth.avatar')}</span>
              <div className="mk-avatar-pick">
                {AVATARS.map((a) => (
                  <button key={a} className={`mk-avatar-opt ${avatar === a ? 'on' : ''}`} onClick={() => setAvatar(a)}>{a}</button>
                ))}
              </div>
            </div>
            <button className="mk-btn primary mk-auth-submit" onClick={doRegister} disabled={!nick.trim()}>
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
