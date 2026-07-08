// Small reusable presentational pieces shared across the Marketplace views.
import { RARITY_COLOR } from '../../lib/market/data';
import { currencyIcon, fmtPrice, sinceParts } from '../../lib/market/helpers';
import { repTier, useRepTiers } from '../../lib/market/repTiers';
import type { Currency, ListingStatus, Rarity, Seller } from '../../lib/market/types';
import { useI18n } from '../../lib/i18n';
import { isCachedContributor } from '../../lib/market/profileCache';
import { useContributors } from './store';

/** Renders an uploaded image (data URL / http) as an avatar, else the emoji glyph. */
export function Avatar({ value, size = '' }: { value: string; size?: 'lg' | 'xxl' | '' }) {
  const isImg = /^(data:|https?:|blob:)/.test(value);
  return (
    <span className={`mk-av ${size}`}>
      {isImg ? <img src={value} alt="" className="mk-av-img" /> : value}
    </span>
  );
}

/** "⭐ Colaborador" seal shown for sellers granted it by an admin. */
export function ContribSeal({ sellerId }: { sellerId: string }) {
  const { t } = useI18n();
  const { isContributor } = useContributors();
  if (!isContributor(sellerId) && !isCachedContributor(sellerId)) return null;
  return <span className="mk-contrib" title={t('mk.contrib.hint')}>⭐ {t('mk.contrib')}</span>;
}

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
  useRepTiers(); // re-render when an admin edits the categories
  const tier = repTier(seller);
  return (
    <span className="mk-rep" style={{ color: tier.color, borderColor: tier.color }} title={t('mk.rep.tier')}>
      {tier.icon} {tier.label}
    </span>
  );
}

