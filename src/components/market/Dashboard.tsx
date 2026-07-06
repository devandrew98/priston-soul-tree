import { useMemo, useState } from 'react';
import { LISTING_BY_ID } from '../../lib/market/data';
import { fmtPrice, sellerItems } from '../../lib/market/helpers';
import type { Listing } from '../../lib/market/types';
import { useI18n } from '../../lib/i18n';
import { useAuth, useFavorites, useMyListings, useWishlist } from './store';
import { ItemCard } from './ItemCard';
import { LoginPrompt } from './LoginPrompt';
import { PriceTag, Since, StatusPill } from './parts';

type Tab = 'active' | 'sold' | 'favorites' | 'wishlist';

export function Dashboard({ onOpen, onSeller, onCreate, onLogin }: { onOpen: (id: string) => void; onSeller: (id: string) => void; onCreate: () => void; onLogin: () => void }) {
  const { t } = useI18n();
  const { userId, user } = useAuth();
  const { myListings, removeListing, duplicateListing } = useMyListings();
  const { favs } = useFavorites();
  const { wishlist, addWish, removeWish } = useWishlist();
  const [tab, setTab] = useState<Tab>('active');
  const [wishText, setWishText] = useState('');
  const [wishMax, setWishMax] = useState('');

  const owned = useMemo(() => (userId ? [...myListings.filter((l) => l.sellerId === userId), ...sellerItems(userId)] : []), [myListings, userId]);
  const active = owned.filter((l) => l.status === 'available');
  const reserved = owned.filter((l) => l.status === 'reserved');
  const sold = owned.filter((l) => l.status === 'sold');
  const favItems = favs.map((id) => LISTING_BY_ID[id]).filter(Boolean) as Listing[];
  const totalViews = owned.reduce((a, l) => a + l.views, 0);
  const profit = sold.reduce((a, l) => a + l.price, 0);

  if (!user) return <LoginPrompt onLogin={onLogin} />;

  return (
    <div className="mk-dash">
      <div className="mk-dash-head">
        <div>
          <h1 className="mk-h1">📊 {t('mk.dash.title')}</h1>
          <p className="mk-muted">{t('mk.dash.hello', { nick: user.nick })}</p>
        </div>
        <button className="mk-btn primary" onClick={onCreate}>+ {t('mk.create.title')}</button>
      </div>

      <div className="mk-dash-stats">
        <KpiCard v={String(active.length)} l={t('mk.dash.active')} />
        <KpiCard v={String(reserved.length)} l={t('mk.status.reserved')} />
        <KpiCard v={String(sold.length)} l={t('mk.dash.sold')} />
        <KpiCard v={String(favItems.length)} l={t('mk.favorites')} />
        <KpiCard v={totalViews.toLocaleString('pt-BR')} l={t('mk.dash.views')} />
        <KpiCard v={fmtPrice(profit)} l={t('mk.dash.profit')} gold />
      </div>

      <div className="mk-dash-tabs">
        {(['active', 'sold', 'favorites', 'wishlist'] as Tab[]).map((tb) => (
          <button key={tb} className={tab === tb ? 'on' : ''} onClick={() => setTab(tb)}>
            {t(`mk.dash.tab.${tb}`)}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        <div className="mk-dash-list">
          {active.map((l) => (
            <div key={l.id} className="mk-dashrow">
              <span className="mk-icon" style={{ ['--rar' as string]: 'var(--gold)' }}>{l.icon}</span>
              <button className="mk-dashrow-name" onClick={() => onOpen(l.id)}>{l.name}</button>
              <StatusPill status={l.status} />
              <span className="mk-muted">👁 {l.views}</span>
              <PriceTag value={l.price} currency={l.currency} />
              <span className="mk-dashrow-actions">
                {myListings.some((m) => m.id === l.id) ? (
                  <>
                    <button className="mk-btn sm" onClick={() => duplicateListing(l.id)}>{t('mk.duplicate')}</button>
                    <button className="mk-btn sm danger" onClick={() => removeListing(l.id)}>{t('mk.delete')}</button>
                  </>
                ) : (
                  <span className="mk-muted">· <Since at={l.createdAt} /></span>
                )}
              </span>
            </div>
          ))}
          {active.length === 0 && <p className="mk-muted">{t('mk.dash.empty')}</p>}
        </div>
      )}

      {tab === 'sold' && (
        <div className="mk-grid">
          {sold.map((l) => <ItemCard key={l.id} listing={l} onOpen={onOpen} onSeller={onSeller} />)}
          {sold.length === 0 && <p className="mk-muted">{t('mk.dash.empty')}</p>}
        </div>
      )}

      {tab === 'favorites' && (
        <div className="mk-grid">
          {favItems.map((l) => <ItemCard key={l.id} listing={l} onOpen={onOpen} onSeller={onSeller} />)}
          {favItems.length === 0 && <p className="mk-muted">{t('mk.dash.nofav')}</p>}
        </div>
      )}

      {tab === 'wishlist' && (
        <div className="mk-wishlist">
          <div className="mk-wishform">
            <input value={wishText} onChange={(e) => setWishText(e.target.value)} placeholder={t('mk.wish.ph')} />
            <input type="number" value={wishMax} onChange={(e) => setWishMax(e.target.value)} placeholder={t('mk.wish.maxprice')} />
            <button className="mk-btn primary" onClick={() => { if (wishText.trim()) { addWish(wishText.trim(), wishMax ? Number(wishMax) : null); setWishText(''); setWishMax(''); } }}>+ {t('mk.wish.add')}</button>
          </div>
          <div className="mk-wishitems">
            {wishlist.map((w) => (
              <div key={w.id} className="mk-wishrow">
                <span className="mk-wish-ic">🎯</span>
                <b>{w.text}</b>
                {w.maxPrice != null && <span className="mk-chip">≤ {fmtPrice(w.maxPrice)}</span>}
                <span className="mk-muted mk-wish-when"><Since at={w.createdAt} /></span>
                <button className="mk-btn sm danger" onClick={() => removeWish(w.id)}>✕</button>
              </div>
            ))}
            {wishlist.length === 0 && <p className="mk-muted">{t('mk.wish.empty')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ v, l, gold }: { v: string; l: string; gold?: boolean }) {
  return (
    <div className={`mk-kpi ${gold ? 'gold' : ''}`}>
      <b>{v}</b>
      <span>{l}</span>
    </div>
  );
}
