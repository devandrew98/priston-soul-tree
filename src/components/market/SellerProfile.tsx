import { useMemo } from 'react';
import { MEDALS, SELLER_BY_ID } from '../../lib/market/data';
import { fmtPrice, sellerItems, sellerReviews } from '../../lib/market/helpers';
import { useI18n } from '../../lib/i18n';
import { useFavSellers } from './store';
import { ItemCard } from './ItemCard';
import { OnlineDot, RepBadge, Since, Stars } from './parts';

const MEDAL_ICON: Record<string, string> = Object.fromEntries(MEDALS.map((m) => [m.id, m.icon]));
const DAY = 86400000;

export function SellerProfile({
  sellerId, onOpen, onSeller, onBack,
}: {
  sellerId: string;
  onOpen: (id: string) => void;
  onSeller: (id: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const { isFavSeller, toggleFavSeller } = useFavSellers();
  const seller = SELLER_BY_ID[sellerId];
  const items = useMemo(() => sellerItems(sellerId), [sellerId]);
  const reviews = useMemo(() => (seller ? sellerReviews(seller) : []), [seller]);

  if (!seller) return <div className="mk-detail"><button className="mk-back" onClick={onBack}>← {t('mk.back')}</button></div>;

  const active = items.filter((i) => i.status === 'available');
  const sold = items.filter((i) => i.status === 'sold');
  const serverDays = Math.floor((Date.now() - seller.joinedAt) / DAY);

  return (
    <div className="mk-detail">
      <button className="mk-back" onClick={onBack}>← {t('mk.back')}</button>

      <div className="mk-profile-head">
        <span className="mk-av xxl">{seller.avatar}</span>
        <div className="mk-profile-id">
          <h1 className="mk-profile-nick">
            {seller.nick}
            {seller.verified && <span className="mk-verified" title={t('mk.verified')}>✔</span>}
            <RepBadge seller={seller} />
          </h1>
          <div className="mk-profile-sub">
            {seller.className} · {t('mk.lvl')} {seller.level} · 🛡 {seller.clan}
          </div>
          <div className="mk-profile-status">
            <OnlineDot online={seller.online} />
            {seller.online ? t('mk.online') : <>{t('mk.lastseen')} <Since at={seller.lastSeen} /></>}
            <span className="mk-muted">· {t('mk.member')} <Since at={seller.joinedAt} /> · {t('mk.onserver', { d: serverDays })}</span>
          </div>
          <div className="mk-profile-actions">
            <button className={`mk-btn sm ${isFavSeller(seller.id) ? 'active' : ''}`} onClick={() => toggleFavSeller(seller.id)}>
              {isFavSeller(seller.id) ? '★' : '☆'} {t('mk.favseller')}
            </button>
            <button className="mk-btn sm" onClick={() => navigator.clipboard?.writeText(`${location.origin}/#seller-${seller.id}`)}>🔗 {t('mk.shareprofile')}</button>
          </div>
          {seller.reports >= 3 && <div className="mk-warn">⚠ {t('mk.reportwarn')}</div>}
        </div>
      </div>

      <div className="mk-profile-stats">
        <Stat v={fmtPrice(seller.totalSalesValue)} l={t('mk.totalsales')} />
        <Stat v={String(seller.itemsSold)} l={t('mk.itemssold')} />
        <Stat v={String(active.length)} l={t('mk.activelistings')} />
        <Stat v={`${seller.ratingAvg.toFixed(1)}★`} l={`${seller.ratingCount} ${t('mk.reviews')}`} />
        <Stat v={`${seller.positivePct}%`} l={t('mk.positive')} />
        <Stat v={`${seller.avgResponseMin}m`} l={t('mk.avgresp')} />
        <Stat v={`${seller.avgCompleteMin}m`} l={t('mk.avgcomplete')} />
      </div>

      {seller.medals.length > 0 && (
        <section className="mk-block">
          <h2 className="mk-h2">{t('mk.medals')}</h2>
          <div className="mk-medals">
            {seller.medals.map((m) => (
              <span key={m} className="mk-medal" title={t(`mk.medal.${m}.d`)}>
                <span className="mk-medal-ic">{MEDAL_ICON[m]}</span> {t(`mk.medal.${m}`)}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mk-block">
        <h2 className="mk-h2">{t('mk.activelistings')} <span className="mk-count">{active.length}</span></h2>
        <div className="mk-grid">
          {active.map((l) => (
            <ItemCard key={l.id} listing={l} onOpen={onOpen} onSeller={onSeller} />
          ))}
          {active.length === 0 && <p className="mk-muted">{t('mk.noactive')}</p>}
        </div>
      </section>

      {sold.length > 0 && (
        <section className="mk-block">
          <h2 className="mk-h2">{t('mk.recentsold')}</h2>
          <div className="mk-grid">
            {sold.slice(0, 4).map((l) => (
              <ItemCard key={l.id} listing={l} onOpen={onOpen} onSeller={onSeller} />
            ))}
          </div>
        </section>
      )}

      <section className="mk-block">
        <h2 className="mk-h2">{t('mk.reviews')} <span className="mk-count">{seller.ratingCount}</span></h2>
        <div className="mk-reviews">
          {reviews.map((r) => (
            <div key={r.id} className="mk-review">
              <span className="mk-av">{r.fromAvatar}</span>
              <div className="mk-review-body">
                <div className="mk-review-head">
                  <b>{r.fromNick}</b> <Stars n={r.stars} /> <span className="mk-muted">· <Since at={r.at} /></span>
                </div>
                <p>{r.comment}</p>
                <div className="mk-review-tags">
                  {r.tags.map((tag) => (
                    <span key={tag} className="mk-tag">{t(`mk.revtag.${tag}`)}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="mk-pstat">
      <b>{v}</b>
      <span>{l}</span>
    </div>
  );
}
