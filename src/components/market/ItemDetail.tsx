import { useMemo, useState } from 'react';
import { RARITY_COLOR } from '../../lib/market/data';
import { priceHistory } from '../../lib/market/data';
import { cheaperAlternatives, fmtPrice, marketStats, sellerItems, similarItems } from '../../lib/market/helpers';
import type { Listing } from '../../lib/market/types';
import { useI18n } from '../../lib/i18n';
import { getSeller, useFavorites } from './store';
import { ItemCard } from './ItemCard';
import { PriceChart } from './PriceChart';
import { Avatar, ContribSeal, OnlineDot, PriceTag, RarityTag, RepBadge, Since, Stars, StatusPill } from './parts';

const TREND_ICON = { up: '📈', down: '📉', stable: '➖' } as const;

export function ItemDetail({
  listing, onOpen, onSeller, onChat, onBack,
}: {
  listing: Listing;
  onOpen: (id: string) => void;
  onSeller: (id: string) => void;
  onChat: (sellerId: string, seed?: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const { isFav, toggleFav } = useFavorites();
  const [note, setNote] = useState('');
  const seller = getSeller(listing.sellerId);
  const glow = RARITY_COLOR[listing.rarity];

  const series = useMemo(() => priceHistory(listing), [listing]);
  const stats = useMemo(() => marketStats(listing, series), [listing, series]);
  const similar = useMemo(() => similarItems(listing), [listing]);
  const cheaper = useMemo(() => cheaperAlternatives(listing), [listing]);
  const fromSeller = useMemo(() => sellerItems(listing.sellerId, listing.id).slice(0, 4), [listing]);

  const diffToLowest = stats.min > 0 ? ((listing.price - stats.min) / stats.min) * 100 : 0;
  const flash = (msg: string) => { setNote(msg); window.setTimeout(() => setNote(''), 2600); };

  if (!seller) return (
    <div className="mk-detail">
      <button className="mk-back" onClick={onBack}>← {t('mk.back')}</button>
      <p className="mk-empty">{t('mk.notfound')}</p>
    </div>
  );

  return (
    <div className="mk-detail">
      <button className="mk-back" onClick={onBack}>← {t('mk.back')}</button>

      <div className="mk-detail-grid">
        {/* left: item */}
        <div className="mk-detail-main">
          <div className="mk-detail-hero">
            <span className="mk-icon xl" style={{ ['--rar' as string]: glow }}>
              {listing.image ? <img src={listing.image} alt={listing.name} className="mk-icon-img" /> : listing.icon}
            </span>
            <div className="mk-detail-headinfo">
              {listing.highlighted && <span className="mk-featured-tag inline">★ {t('mk.featured')}</span>}
              <h1 className="mk-detail-name">{listing.name}</h1>
              <div className="mk-detail-tags">
                <RarityTag rarity={listing.rarity} />
                <span className="mk-chip">{t('mk.lvl')} {listing.itemLevel}</span>
                <StatusPill status={listing.status} />
              </div>
              <div className="mk-detail-price">
                <PriceTag value={listing.price} currency={listing.currency} big />
                {listing.quantity > 1 && <span className="mk-qty">×{listing.quantity}</span>}
              </div>
              <div className="mk-detail-metaline">
                👁 {listing.views.toLocaleString('pt-BR')} · {t('mk.published')} <Since at={listing.createdAt} />
              </div>
            </div>
          </div>

          {listing.stats.length > 0 && (
            <section className="mk-block">
              <h2 className="mk-h2">{t('mk.attributes')}</h2>
              <div className="mk-attrs">
                {listing.stats.map((s) => (
                  <div key={s.label} className="mk-attr">
                    <span>{s.label}</span>
                    <b>{s.value}</b>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mk-block">
            <h2 className="mk-h2">{t('mk.description')}</h2>
            <p className="mk-desc">{listing.description}</p>
          </section>

          {/* market intelligence */}
          <section className="mk-block">
            <h2 className="mk-h2">{t('mk.market')} <span className={`mk-trend ${stats.trend}`}>{TREND_ICON[stats.trend]} {stats.trendPct >= 0 ? '+' : ''}{stats.trendPct.toFixed(1)}%</span></h2>
            <div className="mk-marketgrid">
              <MStat label={t('mk.min')} value={fmtPrice(stats.min, listing.currency)} />
              <MStat label={t('mk.max')} value={fmtPrice(stats.max, listing.currency)} />
              <MStat label={t('mk.avg')} value={fmtPrice(stats.avg, listing.currency)} />
              <MStat label={t('mk.median')} value={fmtPrice(stats.median, listing.currency)} />
              <MStat label={t('mk.listed')} value={String(stats.listed)} />
              <MStat label={t('mk.soldcount')} value={String(stats.sold)} />
              <MStat label={t('mk.lastsale')} value={fmtPrice(stats.lastSale, listing.currency)} />
              <MStat label={t('mk.vslowest')} value={`${diffToLowest >= 0 ? '+' : ''}${diffToLowest.toFixed(0)}%`} tone={diffToLowest <= 0 ? 'good' : 'bad'} />
            </div>
          </section>

          {/* price history */}
          <section className="mk-block">
            <h2 className="mk-h2">{t('mk.hist.title')}</h2>
            <PriceChart series={series} currency={listing.currency} />
          </section>

          {/* recommendations */}
          {cheaper.length > 0 && (
            <RecoRow title={t('mk.reco.cheaper')} items={cheaper} onOpen={onOpen} onSeller={onSeller} />
          )}
          <RecoRow title={t('mk.reco.similar')} items={similar} onOpen={onOpen} onSeller={onSeller} />
          {fromSeller.length > 0 && (
            <RecoRow title={t('mk.reco.sameseller')} items={fromSeller} onOpen={onOpen} onSeller={onSeller} />
          )}
        </div>

        {/* right: seller + actions */}
        <aside className="mk-detail-side">
          <div className="mk-sellercard">
            <button className="mk-sellercard-head" onClick={() => onSeller(seller.id)}>
              <Avatar value={seller.avatar} size="lg" />
              <div>
                <strong>{seller.nick} {seller.verified && <span className="mk-verified" title={t('mk.verified')}>✔</span>}</strong>
                <span className="mk-sellercard-sub">{seller.className} · {t('mk.lvl')} {seller.level} · {seller.clan}</span>
                <ContribSeal sellerId={seller.id} />
              </div>
            </button>
            <div className="mk-sellercard-row">
              <OnlineDot online={seller.online} />
              {seller.online ? t('mk.online') : <>{t('mk.lastseen')} <Since at={seller.lastSeen} /></>}
            </div>
            <div className="mk-sellercard-rep">
              <Stars n={seller.ratingAvg} /> <b>{seller.ratingAvg.toFixed(1)}</b>
              <span className="mk-muted">({seller.ratingCount})</span>
              <RepBadge seller={seller} />
            </div>
            {seller.reports >= 3 && <div className="mk-warn">⚠ {t('mk.reportwarn')}</div>}

            <div className="mk-actions">
              <button className="mk-btn primary" onClick={() => onChat(seller.id, t('mk.chat.seed', { item: listing.name, price: fmtPrice(listing.price, listing.currency) }))}>💬 {t('mk.interest')}</button>
              <button className="mk-btn" onClick={() => onChat(seller.id)}>✉ {t('mk.message')}</button>
              <div className="mk-actions-row">
                <button className={`mk-btn sm ${isFav(listing.id) ? 'active' : ''}`} onClick={() => toggleFav(listing.id)}>
                  {isFav(listing.id) ? '★' : '☆'} {t('mk.favorite')}
                </button>
                <button className="mk-btn sm" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/#item-${listing.id}`); flash(t('mk.flash.shared')); }}>🔗 {t('mk.share')}</button>
                <button className="mk-btn sm danger" onClick={() => flash(t('mk.flash.reported'))}>⚑ {t('mk.report')}</button>
              </div>
            </div>
            {note && <div className="mk-note">{note}</div>}

            <div className="mk-sellerstats">
              <div><b>{seller.itemsSold}</b><span>{t('mk.itemssold')}</span></div>
              <div><b>{seller.positivePct}%</b><span>{t('mk.positive')}</span></div>
              <div><b>{seller.avgResponseMin}m</b><span>{t('mk.avgresp')}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MStat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="mk-mstat">
      <span className="mk-mstat-lbl">{label}</span>
      <b className={tone ? `mk-${tone}` : ''}>{value}</b>
    </div>
  );
}

function RecoRow({ title, items, onOpen, onSeller }: { title: string; items: Listing[]; onOpen: (id: string) => void; onSeller: (id: string) => void }) {
  return (
    <section className="mk-block">
      <h2 className="mk-h2">{title}</h2>
      <div className="mk-reco">
        {items.map((l) => (
          <ItemCard key={l.id} listing={l} onOpen={onOpen} onSeller={onSeller} />
        ))}
      </div>
    </section>
  );
}
