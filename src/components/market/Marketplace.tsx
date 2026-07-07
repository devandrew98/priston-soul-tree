import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { Browse } from './Browse';
import { ItemDetail } from './ItemDetail';
import { SellerProfile } from './SellerProfile';
import { CreateListing } from './CreateListing';
import { Dashboard } from './Dashboard';
import { Chat } from './Chat';
import { Stats } from './Stats';
import { Admin } from './Admin';
import { NotificationBell } from './NotificationBell';
import { AuthModal } from './AuthModal';
import { type NotifLink, useAuth, useChats } from './store';
import { useListing } from './useMarketData';
import { Avatar, RepBadge } from './parts';

const PANEL_PASSWORD = 'painel159753';

type View =
  | { name: 'browse' }
  | { name: 'item'; id: string }
  | { name: 'seller'; id: string }
  | { name: 'create' }
  | { name: 'dashboard' }
  | { name: 'stats' }
  | { name: 'messages'; seller?: string }
  | { name: 'admin' };

const TABS: { name: View['name']; icon: string; key: string; admin?: boolean }[] = [
  { name: 'browse', icon: '🏪', key: 'mk.tab.browse' },
  { name: 'stats', icon: '📈', key: 'mk.tab.stats' },
  { name: 'messages', icon: '💬', key: 'mk.tab.messages' },
  { name: 'dashboard', icon: '📊', key: 'mk.tab.dashboard' },
  { name: 'create', icon: '📦', key: 'mk.tab.create' },
  { name: 'admin', icon: '🛡️', key: 'mk.tab.admin', admin: true },
];

export function Marketplace() {
  const { t } = useI18n();
  const { totalUnread, startConversation } = useChats();
  const { isAdmin } = useAuth();
  const [view, setView] = useState<View>({ name: 'browse' });
  const [showAuth, setShowAuth] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const openItem = (id: string) => { setView({ name: 'item', id }); window.scrollTo({ top: 0 }); };
  const openSeller = (id: string) => { setView({ name: 'seller', id }); window.scrollTo({ top: 0 }); };
  const go = (name: View['name']) => { setView({ name } as View); window.scrollTo({ top: 0 }); };
  const openChat = (sellerId: string, seed?: string) => {
    startConversation(sellerId, seed);
    setView({ name: 'messages', seller: sellerId });
    window.scrollTo({ top: 0 });
  };
  const onNotifNav = (link: NotifLink) => {
    if (link.kind === 'messages') setView({ name: 'messages' });
    else if (link.kind === 'item' && link.id) openItem(link.id);
    else if (link.kind === 'seller' && link.id) openSeller(link.id);
    window.scrollTo({ top: 0 });
  };

  const tabs = TABS.filter((tb) => !tb.admin || isAdmin);
  const openLogin = () => setShowAuth(true);

  return (
    <div className="mk">
      <header className="mk-head">
        <div className="mk-head-title">
          <h1 className="mk-title">🏰 {t('mk.title')}</h1>
          <p className="mk-sub">{t('mk.subtitle')}</p>
        </div>
        <div className="mk-head-tools">
          <nav className="mk-subnav">
            {tabs.map((tb) => (
              <button
                key={tb.name}
                className={`mk-subtab ${view.name === tb.name ? 'active' : ''} ${tb.admin ? 'admin' : ''}`}
                onClick={() => go(tb.name)}
              >
                {tb.icon} {t(tb.key)}
                {tb.name === 'messages' && totalUnread > 0 && <span className="mk-chat-badge sm">{totalUnread}</span>}
              </button>
            ))}
          </nav>
          <NotificationBell onNavigate={onNotifNav} />
          <UserMenu onLogin={openLogin} onDashboard={() => go('dashboard')} />
        </div>
      </header>

      {view.name === 'browse' && <Browse onOpen={openItem} onSeller={openSeller} />}
      {view.name === 'stats' && <Stats onOpen={openItem} onSeller={openSeller} />}
      {view.name === 'messages' && <Chat initialSeller={view.seller} onSeller={openSeller} />}
      {view.name === 'dashboard' && <Dashboard onOpen={openItem} onSeller={openSeller} onCreate={() => go('create')} onLogin={openLogin} />}
      {view.name === 'create' && <CreateListing onDone={() => go('dashboard')} onLogin={openLogin} />}
      {view.name === 'admin' && (adminUnlocked ? <Admin onOpen={openItem} onSeller={openSeller} /> : <AdminGate onUnlock={() => setAdminUnlocked(true)} />)}
      {view.name === 'item' && <ItemView id={view.id} onOpen={openItem} onSeller={openSeller} onChat={openChat} onBack={() => go('browse')} />}
      {view.name === 'seller' && <SellerProfile sellerId={view.id} onOpen={openItem} onSeller={openSeller} onChat={openChat} onBack={() => go('browse')} />}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}

function UserMenu({ onLogin, onDashboard }: { onLogin: () => void; onDashboard: () => void }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!user) return <button className="mk-btn primary mk-login-btn" onClick={onLogin}>👤 {t('mk.auth.login')}</button>;

  return (
    <div className="mk-usermenu" ref={ref}>
      <button className="mk-userchip" onClick={() => setOpen((o) => !o)}>
        <Avatar value={user.avatar} />
        <span className="mk-userchip-nick">{user.nick}</span>
      </button>
      {open && (
        <div className="mk-usermenu-panel">
          <div className="mk-usermenu-head">
            <Avatar value={user.avatar} size="lg" />
            <div>
              <b>{user.nick}</b>
              <RepBadge seller={user} />
            </div>
          </div>
          <button onClick={() => { setOpen(false); onDashboard(); }}>📊 {t('mk.tab.dashboard')}</button>
          <button onClick={() => { setOpen(false); logout(); }}>🚪 {t('mk.auth.logout')}</button>
        </div>
      )}
    </div>
  );
}

function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useI18n();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const submit = () => { if (pw === PANEL_PASSWORD) onUnlock(); else setErr(true); };
  return (
    <div className="mk-admingate">
      <span className="mk-admingate-ic">🔐</span>
      <h2>{t('mk.admin.gate.title')}</h2>
      <p className="mk-muted">{t('mk.admin.gate.sub')}</p>
      <div className="mk-admingate-form">
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setErr(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder={t('mk.admin.gate.ph')}
          autoFocus
        />
        <button className="mk-btn primary" onClick={submit}>{t('mk.admin.gate.enter')}</button>
      </div>
      {err && <p className="mk-admingate-err">✕ {t('mk.admin.gate.wrong')}</p>}
    </div>
  );
}

function ItemView({ id, onOpen, onSeller, onChat, onBack }: { id: string; onOpen: (id: string) => void; onSeller: (id: string) => void; onChat: (sellerId: string, seed?: string) => void; onBack: () => void }) {
  const { t } = useI18n();
  const { listing, loading } = useListing(id);
  if (loading) return <div className="mk-detail"><button className="mk-back" onClick={onBack}>← {t('mk.back')}</button><p className="mk-empty">⏳ {t('mk.loading')}</p></div>;
  if (!listing) return <NotFound onBack={onBack} />;
  return <ItemDetail listing={listing} onOpen={onOpen} onSeller={onSeller} onChat={onChat} onBack={onBack} />;
}

function NotFound({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mk-detail">
      <button className="mk-back" onClick={onBack}>← {t('mk.back')}</button>
      <p className="mk-empty">{t('mk.notfound')}</p>
    </div>
  );
}
