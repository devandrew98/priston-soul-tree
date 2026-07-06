import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { type NotifLink, useNotifications } from './store';
import { Since } from './parts';

const ICON: Record<string, string> = {
  message: '💬', interest: '🤝', sold: '💰', reserved: '🔒',
  expiring: '⏳', review: '⭐', wishlist: '🎯', global: '📢',
};

export function NotificationBell({ onNavigate }: { onNavigate: (link: NotifLink) => void }) {
  const { t } = useI18n();
  const { notifications, unread, markRead, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const click = (id: string, link?: NotifLink) => {
    markRead(id);
    if (link) { onNavigate(link); setOpen(false); }
  };

  return (
    <div className="mk-bell" ref={ref}>
      <button className={`mk-bell-btn ${unread ? 'has' : ''}`} onClick={() => setOpen((o) => !o)} title={t('mk.notif.title')}>
        🔔{unread > 0 && <span className="mk-bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="mk-notif-panel">
          <div className="mk-notif-head">
            <b>{t('mk.notif.title')}</b>
            <span className="mk-notif-actions">
              <button onClick={markAllRead}>{t('mk.notif.markall')}</button>
              <button onClick={clearAll}>{t('mk.notif.clear')}</button>
            </span>
          </div>
          <div className="mk-notif-list">
            {notifications.length === 0 && <p className="mk-muted mk-notif-empty">{t('mk.notif.empty')}</p>}
            {notifications.map((n) => (
              <button key={n.id} className={`mk-notif ${n.read ? '' : 'unread'}`} onClick={() => click(n.id, n.link)}>
                <span className="mk-notif-ic">{ICON[n.type] || '🔔'}</span>
                <span className="mk-notif-body">
                  <span className="mk-notif-text">{t(`mk.notif.${n.type}`, n.params)}</span>
                  <span className="mk-notif-time"><Since at={n.at} /></span>
                </span>
                {!n.read && <span className="mk-notif-dot" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
