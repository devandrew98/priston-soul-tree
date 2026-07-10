import { useMemo, useState } from 'react';
import { fmtPrice, sellerItems } from '../../lib/market/helpers';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { deleteListing, setListingStatus } from '../../lib/market/listings';
import { useI18n } from '../../lib/i18n';
import { useAuth, useMyListings, useWishlist } from './store';
import { useFavoriteListings, useSellerListings } from './useMarketData';
import { AvatarEditor } from './AvatarEditor';
import { ItemCard } from './ItemCard';
import { LoginPrompt } from './LoginPrompt';
import { Avatar, PriceTag, Since, StatusPill } from './parts';

type Tab = 'active' | 'sold' | 'favorites' | 'wishlist';

export function Dashboard({ onOpen, onSeller, onCreate, onEdit, onLogin }: { onOpen: (id: string) => void; onSeller: (id: string) => void; onCreate: () => void; onEdit: (id: string) => void; onLogin: () => void }) {
  const { t } = useI18n();
  const { userId, user } = useAuth();
  const { myListings, removeListing, duplicateListing } = useMyListings();
  const { wishlist, addWish, removeWish } = useWishlist();
  const dbSeller = useSellerListings(userId || '');
  const { listings: favItems } = useFavoriteListings();
  const [tab, setTab] = useState<Tab>('active');
  const [wishText, setWishText] = useState('');
  const [wishMax, setWishMax] = useState('');

  const mockOwned = useMemo(() => (userId ? [...myListings.filter((l) => l.sellerId === userId), ...sellerItems(userId)] : []), [myListings, userId]);
  const owned = BACKEND_ENABLED ? dbSeller.listings : mockOwned;
  const del = async (id: string) => {
    if (BACKEND_ENABLED) { await deleteListing(id); dbSeller.reload(); }
    else removeListing(id);
  };
  const markSold = async (id: string) => { await setListingStatus(id, 'sold'); dbSeller.reload(); };
  const active = owned.filter((l) => l.status === 'available');
  const reserved = owned.filter((l) => l.status === 'reserved');
  const sold = owned.filter((l) => l.status === 'sold');
  const totalViews = owned.reduce((a, l) => a + l.views, 0);
  const profit = sold.reduce((a, l) => a + l.price, 0);

  if (!user) return <LoginPrompt onLogin={onLogin} />;

  return (
    <div className="mk-dash">
      <div className="mk-dash-head">
        <div className="mk-dash-ident">
          {BACKEND_ENABLED && userId
            ? <AvatarEditor userId={userId} avatar={user.avatar} size="lg" />
            : <Avatar value={user.avatar} size="lg" />}
          <div>
            <h1 className="mk-h1">📊 {t('mk.dash.title')}</h1>
            <p className="mk-muted">{t('mk.dash.hello', { nick: user.nick })}</p>
          </div>
        </div>
        <div className="mk-dash-headbtns">
          {userId && <button className="mk-btn" onClick={() => onSeller(userId)}>👤 {t('mk.dash.viewprofile')}</button>}
          <button className="mk-btn primary" onClick={onCreate}>+ {t('mk.create.title')}</button>
        </div>
      </div>

      <div className="mk-dash-stats">
        {/* KPIs clicáveis: levam direto pra aba correspondente. */}
        <KpiCard v={String(active.length)} l={t('mk.dash.active')} onClick={() => setTab('active')} />
        <KpiCard v={String(reserved.length)} l={t('mk.status.reserved')} onClick={() => setTab('active')} />
        <KpiCard v={String(sold.length)} l={t('mk.dash.sold')} onClick={() => setTab('sold')} />
        <KpiCard v={String(favItems.length)} l={t('mk.favorites')} onClick={() => setTab('favorites')} />
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
              <span className="mk-icon" style={{ ['--rar' as string]: 'var(--gold)' }}>{l.image ? <img src={l.image} alt="" className="mk-icon-img" /> : l.icon}</span>
              <button className="mk-dashrow-name" onClick={() => onOpen(l.id)}>{l.name}</button>
              <StatusPill status={l.status} />
              <span className="mk-muted">👁 {l.views}</span>
              <PriceTag value={l.price} currency={l.currency} />
              <span className="mk-dashrow-actions">
                {BACKEND_ENABLED ? (
                  <>
                    <button className="mk-btn sm primary" onClick={() => markSold(l.id)}>{t('mk.dash.marksold')}</button>
                    <button className="mk-btn sm" onClick={() => onEdit(l.id)}>{t('mk.edit')}</button>
                    <button className="mk-btn sm danger" onClick={() => del(l.id)}>{t('mk.delete')}</button>
                  </>
                ) : myListings.some((m) => m.id === l.id) ? (
                  <>
                    <button className="mk-btn sm" onClick={() => onEdit(l.id)}>{t('mk.edit')}</button>
                    <button className="mk-btn sm" onClick={() => duplicateListing(l.id)}>{t('mk.duplicate')}</button>
                    <button className="mk-btn sm danger" onClick={() => del(l.id)}>{t('mk.delete')}</button>
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

function KpiCard({ v, l, gold, onClick }: { v: string; l: string; gold?: boolean; onClick?: () => void }) {
  return (
    <div className={`mk-kpi ${gold ? 'gold' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <b>{v}</b>
      <span>{l}</span>
    </div>
  );
}
