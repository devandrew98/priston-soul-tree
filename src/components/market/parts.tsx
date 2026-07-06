// Small reusable presentational pieces shared across the Marketplace views.
import { RARITY_COLOR } from '../../lib/market/data';
import { currencyIcon, fmtPrice, repTier, repLevelLabel, sinceParts } from '../../lib/market/helpers';
import type { Currency, ListingStatus, Rarity, Seller } from '../../lib/market/types';
import { useI18n } from '../../lib/i18n';

export function Stars({ n, size = 14 }: { n: number; size?: number }) {
  const full = Math.round(n);
  return (
    <span className="mk-stars" style={{ fontSize: size }} aria-label={`${n.toFixed(1)} / 5`}>
      {'★★★★★'.slice(0, full)}
      <span className="mk-stars-empty">{'★★★★★'.slice(full)}</span>
    </span>
  );
}

export function Since({ at }: { at: number }) {
  const { t } = useI18n();
  const { value, unit } = sinceParts(at);
  return <>{t(`mk.time.${unit}`, { n: value })}</>;
}

export function OnlineDot({ online }: { online: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`mk-dot ${online ? 'on' : 'off'}`} title={online ? t('mk.online') : t('mk.offline')}>
      ●
    </span>
  );
}

export function RarityTag({ rarity }: { rarity: Rarity }) {
  const { t } = useI18n();
  return (
    <span className="mk-rarity" style={{ color: RARITY_COLOR[rarity], borderColor: RARITY_COLOR[rarity] }}>
      {t(`mk.rarity.${rarity}`)}
    </span>
  );
}

export function StatusPill({ status }: { status: ListingStatus }) {
  const { t } = useI18n();
  return <span className={`mk-status ${status}`}>{t(`mk.status.${status}`)}</span>;
}

export function PriceTag({ value, currency, big }: { value: number; currency: Currency; big?: boolean }) {
  return (
    <span className={`mk-price ${big ? 'big' : ''}`}>
      <span className="mk-price-coin">{currencyIcon(currency)}</span>
      {fmtPrice(value, currency)}
    </span>
  );
}

export function RepBadge({ seller }: { seller: Seller }) {
  const { t } = useI18n();
  const tier = repTier(seller);
  return (
    <span className="mk-rep" style={{ color: tier.color, borderColor: tier.color }} title={t('mk.rep.tier')}>
      {tier.icon} {repLevelLabel(tier.id)}
    </span>
  );
}

export function Sockets({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="mk-sockets" title={`${n} soquetes`}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="mk-socket" />
      ))}
    </span>
  );
}
