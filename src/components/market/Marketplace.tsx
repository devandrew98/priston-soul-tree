import { useState } from 'react';
import { LISTING_BY_ID } from '../../lib/market/data';
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
import { IS_ADMIN, type NotifLink, useChats, useMyListings } from './store';

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
  const { myListings } = useMyListings();
  const { totalUnread, startConversation } = useChats();
  const [view, setView] = useState<View>({ name: 'browse' });

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

  const resolve = (id: string) => LISTING_BY_ID[id] || myListings.find((l) => l.id === id);
  const tabs = TABS.filter((tb) => !tb.admin || IS_ADMIN);

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
        </div>
      </header>

      {view.name === 'browse' && <Browse onOpen={openItem} onSeller={openSeller} />}
      {view.name === 'stats' && <Stats onOpen={openItem} onSeller={openSeller} />}
      {view.name === 'messages' && <Chat initialSeller={view.seller} onSeller={openSeller} />}
      {view.name === 'dashboard' && <Dashboard onOpen={openItem} onSeller={openSeller} onCreate={() => go('create')} />}
      {view.name === 'create' && <CreateListing onDone={() => go('dashboard')} />}
      {view.name === 'admin' && <Admin onOpen={openItem} onSeller={openSeller} />}
      {view.name === 'item' && (() => {
        const l = resolve(view.id);
        return l ? <ItemDetail listing={l} onOpen={openItem} onSeller={openSeller} onChat={openChat} onBack={() => go('browse')} /> : <NotFound onBack={() => go('browse')} />;
      })()}
      {view.name === 'seller' && <SellerProfile sellerId={view.id} onOpen={openItem} onSeller={openSeller} onChat={openChat} onBack={() => go('browse')} />}
    </div>
  );
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
