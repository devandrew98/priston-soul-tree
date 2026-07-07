import { RARITY_COLOR } from '../../lib/market/data';
import { getSeller } from './store';
import type { Listing } from '../../lib/market/types';
import { Avatar, ContribSeal, OnlineDot, PriceTag, RarityTag, Since, StatusPill } from './parts';
import { useI18n } from '../../lib/i18n';

export function ItemCard({ listing, onOpen, onSeller }: { listing: Listing; onOpen: (id: string) => void; onSeller: (id: string) => void }) {
  const { t } = useI18n();
  const seller = getSeller(listing.sellerId);
  const glow = RARITY_COLOR[listing.rarity];

  return (
    <div
      className={`mk-card ${listing.highlighted ? 'featured' : ''}`}
      style={{ ['--rar' as string]: glow }}
      onClick={() => onOpen(listing.id)}
    >
      {listing.highlighted && <span className="mk-featured-tag">★ {t('mk.featured')}</span>}
      <div className="mk-card-top">
        <span className="mk-icon" style={{ ['--rar' as string]: glow }}>
          {listing.image ? <img src={listing.image} alt={listing.name} className="mk-icon-img" /> : listing.icon}
        </span>
        <div className="mk-card-head">
          <strong className="mk-card-name">{listing.name}</strong>
          <span className="mk-card-meta">
            <RarityTag rarity={listing.rarity} /> · {t('mk.lvl')} {listing.itemLevel}
          </span>
        </div>
      </div>

      {listing.stats.length > 0 && (
        <div className="mk-card-stats">
          {listing.stats.slice(0, 3).map((s) => (
            <span key={s.label} className="mk-chip">
              {s.label}: <b>{s.value}</b>
            </span>
          ))}
        </div>
      )}

      <div className="mk-card-foot">
        <PriceTag value={listing.price} currency={listing.currency} />
        <StatusPill status={listing.status} />
      </div>

      <button
        className="mk-card-seller"
        onClick={(e) => { e.stopPropagation(); onSeller(listing.sellerId); }}
      >
        <Avatar value={seller?.avatar || ''} />
        <span className="mk-seller-nick">{seller?.nick}</span>
        <ContribSeal sellerId={listing.sellerId} />
        <OnlineDot online={!!seller?.online} />
        <span className="mk-seller-when">· <Since at={listing.createdAt} /></span>
      </button>
    </div>
  );
}
