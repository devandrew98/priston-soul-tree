import { RARITY_COLOR } from '../../lib/market/data';
import { SELLER_BY_ID } from '../../lib/market/data';
import type { Listing } from '../../lib/market/types';
import { useI18n } from '../../lib/i18n';
import { OnlineDot, PriceTag, RarityTag, Since, Sockets, StatusPill } from './parts';

export function ItemCard({ listing, onOpen, onSeller }: { listing: Listing; onOpen: (id: string) => void; onSeller: (id: string) => void }) {
  const { t } = useI18n();
  const seller = SELLER_BY_ID[listing.sellerId];
  const glow = RARITY_COLOR[listing.rarity];

  return (
    <div
      className={`mk-card ${listing.highlighted ? 'featured' : ''}`}
      style={{ ['--rar' as string]: glow }}
      onClick={() => onOpen(listing.id)}
    >
      {listing.highlighted && <span className="mk-featured-tag">★ {t('mk.featured')}</span>}
      <div className="mk-card-top">
        <span className="mk-icon" style={{ ['--rar' as string]: glow }}>{listing.icon}</span>
        <div className="mk-card-head">
          <strong className="mk-card-name">{listing.name}</strong>
          <span className="mk-card-meta">
            <RarityTag rarity={listing.rarity} /> · T{listing.tier} · {t('mk.lvl')} {listing.itemLevel}
          </span>
        </div>
      </div>

      <div className="mk-card-stats">
        {listing.stats.slice(0, 3).map((s) => (
          <span key={s.label} className="mk-chip">
            {s.label}: <b>{s.value}</b>
          </span>
        ))}
        <Sockets n={listing.sockets} />
      </div>

      <div className="mk-card-foot">
        <PriceTag value={listing.price} currency={listing.currency} />
        <StatusPill status={listing.status} />
      </div>

      <button
        className="mk-card-seller"
        onClick={(e) => { e.stopPropagation(); onSeller(listing.sellerId); }}
      >
        <span className="mk-av">{seller?.avatar}</span>
        <span className="mk-seller-nick">{seller?.nick}</span>
        <OnlineDot online={!!seller?.online} />
        <span className="mk-seller-when">· <Since at={listing.createdAt} /></span>
      </button>
    </div>
  );
}
