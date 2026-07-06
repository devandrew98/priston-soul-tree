import { useState } from 'react';
import { LISTING_BY_ID } from '../../lib/market/data';
import { useI18n } from '../../lib/i18n';
import { Browse } from './Browse';
import { ItemDetail } from './ItemDetail';
import { SellerProfile } from './SellerProfile';
import { CreateListing } from './CreateListing';
import { Dashboard } from './Dashboard';
import { useMyListings } from './store';

type View =
  | { name: 'browse' }
  | { name: 'item'; id: string }
  | { name: 'seller'; id: string }
  | { name: 'create' }
  | { name: 'dashboard' };

const TABS: { name: View['name']; icon: string; key: string }[] = [
  { name: 'browse', icon: '🏪', key: 'mk.tab.browse' },
  { name: 'dashboard', icon: '📊', key: 'mk.tab.dashboard' },
  { name: 'create', icon: '📦', key: 'mk.tab.create' },
];

export function Marketplace() {
  const { t } = useI18n();
  const { myListings } = useMyListings();
  const [view, setView] = useState<View>({ name: 'browse' });

  const openItem = (id: string) => { setView({ name: 'item', id }); window.scrollTo({ top: 0 }); };
  const openSeller = (id: string) => { setView({ name: 'seller', id }); window.scrollTo({ top: 0 }); };
  const go = (name: View['name']) => { setView({ name } as View); window.scrollTo({ top: 0 }); };

  const resolve = (id: string) => LISTING_BY_ID[id] || myListings.find((l) => l.id === id);

  return (
    <div className="mk">
      <header className="mk-head">
        <div className="mk-head-title">
          <h1 className="mk-title">🏰 {t('mk.title')}</h1>
          <p className="mk-sub">{t('mk.subtitle')}</p>
        </div>
        <nav className="mk-subnav">
          {TABS.map((tb) => (
            <button
              key={tb.name}
              className={`mk-subtab ${view.name === tb.name ? 'active' : ''}`}
              onClick={() => go(tb.name)}
            >
              {tb.icon} {t(tb.key)}
            </button>
          ))}
        </nav>
      </header>

      {view.name === 'browse' && <Browse onOpen={openItem} onSeller={openSeller} />}
      {view.name === 'dashboard' && <Dashboard onOpen={openItem} onSeller={openSeller} onCreate={() => go('create')} />}
      {view.name === 'create' && <CreateListing onDone={() => go('dashboard')} />}
      {view.name === 'item' && (() => {
        const l = resolve(view.id);
        return l ? <ItemDetail listing={l} onOpen={openItem} onSeller={openSeller} onBack={() => go('browse')} /> : <NotFound onBack={() => go('browse')} />;
      })()}
      {view.name === 'seller' && <SellerProfile sellerId={view.id} onOpen={openItem} onSeller={openSeller} onBack={() => go('browse')} />}
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
