// A small "live now" badge in the corner of every page of the site while someone from the community is streaming.
// Hover (or tap) opens the list; picking a streamer opens their live in a new tab. Hidden when nobody is live.
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '../lib/analytics';
import { useI18n } from '../lib/i18n';
import { channelUrl } from '../lib/market/streamers';
import { useStreamers } from './market/useStreamers';

const HIDE_KEY = 'pz-live-hidden';

const TXT = {
  live: { pt: 'AO VIVO', en: 'LIVE' },
  title: { pt: 'Ao vivo agora', en: 'Live now' },
  viewers: { pt: 'espectadores', en: 'viewers' },
  hide: { pt: 'Esconder', en: 'Hide' },
  all: { pt: 'Ver todos os streamers', en: 'See all streamers' },
} as const;

const PLAT_ICON = { twitch: '🟣', youtube: '🔴' } as const;

export function LiveBadge({ onSeeAll }: { onSeeAll: () => void }) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const { online } = useStreamers();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
  });
  const box = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  // Close on outside click or Escape (the way a phone user dismisses it).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  if (online.length === 0 || hidden) return null;

  const enter = () => { window.clearTimeout(closeTimer.current); setOpen(true); };
  const leave = () => { window.clearTimeout(closeTimer.current); closeTimer.current = window.setTimeout(() => setOpen(false), 250); };
  const hide = () => { setHidden(true); try { sessionStorage.setItem(HIDE_KEY, '1'); } catch { /* ignore */ } };

  return (
    <div className="live-badge" ref={box} onMouseEnter={enter} onMouseLeave={leave}>
      {open && (
        <div className="live-panel" role="dialog" aria-label={T('title')}>
          <div className="live-panel-head">
            <b><span className="live-dot" /> {T('title')}</b>
            <button type="button" className="live-hide" onClick={hide} title={T('hide')} aria-label={T('hide')}>✕</button>
          </div>
          <div className="live-list">
            {online.map((s) => (
              <a key={s.id} className="live-item" href={channelUrl(s)} target="_blank" rel="noopener noreferrer"
                onClick={() => trackEvent('live:open')}>
                <span className="live-thumb">{s.coverUrl ? <img src={s.coverUrl} alt="" /> : <span>{PLAT_ICON[s.platform]}</span>}</span>
                <span className="live-info">
                  <b>{s.name}</b>
                  {s.title && <small>{s.title}</small>}
                  <small className="live-meta">
                    {PLAT_ICON[s.platform]} {s.platform === 'twitch' ? 'Twitch' : 'YouTube'}
                    {s.platform === 'twitch' && s.viewers > 0 ? ` · 👁 ${s.viewers.toLocaleString('pt-BR')} ${T('viewers')}` : ''}
                  </small>
                </span>
                <span className="live-go" aria-hidden="true">▶</span>
              </a>
            ))}
          </div>
          <button type="button" className="live-all" onClick={() => { setOpen(false); onSeeAll(); }}>{T('all')} →</button>
        </div>
      )}
      <button type="button" className="live-pill" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="live-dot" /> {T('live')} <b>{online.length}</b>
      </button>
    </div>
  );
}
