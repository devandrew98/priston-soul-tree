import { useRef, useState } from 'react';
import { MEDALS } from '../../lib/market/data';
import { fmtPrice } from '../../lib/market/helpers';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { updateAvatar, uploadToBucket } from '../../lib/market/auth';
import { useI18n } from '../../lib/i18n';
import { getSeller, useAuth, useFavSellers } from './store';
import { refreshProfile } from './session';
import { useSellerListings, useSellerReputation } from './useMarketData';
import { ItemCard } from './ItemCard';
import { ReviewForm } from './ReviewForm';
import { Avatar, ContribSeal, OnlineDot, RepBadge, Since, Stars } from './parts';

const MEDAL_ICON: Record<string, string> = Object.fromEntries(MEDALS.map((m) => [m.id, m.icon]));
const DAY = 86400000;

export function SellerProfile({
  sellerId, onOpen, onSeller, onChat, onBack,
}: {
  sellerId: string;
  onOpen: (id: string) => void;
  onSeller: (id: string) => void;
  onChat: (sellerId: string, seed?: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const { userId } = useAuth();
  const { isFavSeller, toggleFavSeller } = useFavSellers();
  const { listings: items, loading } = useSellerListings(sellerId);
  const seller = getSeller(sellerId);
  const { reviews, aggregates, reloadReviews } = useSellerReputation(sellerId, seller);

  // Own-profile avatar editing.
  const own = !!userId && userId === sellerId && BACKEND_ENABLED;
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarOverride, setAvatarOverride] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState('');
  const changeAvatar = async (file?: File) => {
    if (!file || !userId) return;
    if (!file.type.startsWith('image/')) { setAvatarErr(t('mk.profile.avatarerr')); return; }
    setAvatarErr(''); setAvatarBusy(true);
    try {
      const url = await uploadToBucket('avatars', userId, file);
      await updateAvatar(userId, url);
      setAvatarOverride(url);
      refreshProfile();
    } catch (e) { setAvatarErr(e instanceof Error ? e.message : String(e)); }
    finally { setAvatarBusy(false); }
  };

  if (!seller) {
    return (
      <div className="mk-detail">
        <button className="mk-back" onClick={onBack}>← {t('mk.back')}</button>
        <p className="mk-empty">{loading ? `⏳ ${t('mk.loading')}` : t('mk.notfound')}</p>
      </div>
    );
  }

  const active = items.filter((i) => i.status === 'available');
  const sold = items.filter((i) => i.status === 'sold');
  const serverDays = Math.floor((Date.now() - seller.joinedAt) / DAY);
  // Prefer live DB aggregates, fall back to the (mock) profile values.
  const ratingAvg = aggregates?.ratingAvg ?? seller.ratingAvg;
  const ratingCount = aggregates?.ratingCount ?? seller.ratingCount;
  const itemsSold = aggregates?.itemsSold ?? seller.itemsSold;
  const totalSales = aggregates?.totalSalesValue ?? seller.totalSalesValue;
  const activeCount = aggregates?.activeListings ?? active.length;
  const canReview = !!userId && userId !== seller.id;

  return (
    <div className="mk-detail">
      <button className="mk-back" onClick={onBack}>← {t('mk.back')}</button>

      <div className="mk-profile-head">
        <div className={`mk-profile-avatar ${own ? 'editable' : ''}`}>
          <Avatar value={avatarOverride || seller.avatar} size="xxl" />
          {own && (
            <>
              <button className="mk-avatar-edit" onClick={() => fileRef.current?.click()} disabled={avatarBusy} title={t('mk.profile.changeavatar')}>
                {avatarBusy ? '⏳' : '📷'}
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/bmp,image/jpeg,image/webp" hidden onChange={(e) => changeAvatar(e.target.files?.[0])} />
            </>
          )}
        </div>
        <div className="mk-profile-id">
          <h1 className="mk-profile-nick">
            {seller.nick}
            {seller.verified && <span className="mk-verified" title={t('mk.verified')}>✔</span>}
            <RepBadge seller={seller} />
            <ContribSeal sellerId={seller.id} />
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
            <button className="mk-btn sm primary" onClick={() => onChat(seller.id)}>💬 {t('mk.message')}</button>
            <button className={`mk-btn sm ${isFavSeller(seller.id) ? 'active' : ''}`} onClick={() => toggleFavSeller(seller.id)}>
              {isFavSeller(seller.id) ? '★' : '☆'} {t('mk.favseller')}
            </button>
            <button className="mk-btn sm" onClick={() => navigator.clipboard?.writeText(`${location.origin}/#seller-${seller.id}`)}>🔗 {t('mk.shareprofile')}</button>
          </div>
          {own && <div className="mk-profile-avatar-hint">{avatarErr ? <span className="mk-auth-err">✕ {avatarErr}</span> : <span className="mk-muted">📷 {t('mk.profile.changeavatar')}</span>}</div>}
          {seller.reports >= 3 && <div className="mk-warn">⚠ {t('mk.reportwarn')}</div>}
        </div>
      </div>

      <div className="mk-profile-stats">
        <Stat v={fmtPrice(totalSales)} l={t('mk.totalsales')} />
        <Stat v={String(itemsSold)} l={t('mk.itemssold')} />
        <Stat v={String(activeCount)} l={t('mk.activelistings')} />
        <Stat v={`${ratingAvg.toFixed(1)}★`} l={`${ratingCount} ${t('mk.reviews')}`} />
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
        <h2 className="mk-h2">{t('mk.reviews')} <span className="mk-count">{ratingCount}</span></h2>
        {canReview && <ReviewForm sellerId={seller.id} authorId={userId!} onDone={reloadReviews} />}
        <div className="mk-reviews">
          {reviews.map((r) => (
            <div key={r.id} className="mk-review">
              <Avatar value={r.fromAvatar} />
              <div className="mk-review-body">
                <div className="mk-review-head">
                  <b>{r.fromNick}</b> <Stars n={r.stars} /> <span className="mk-muted">· <Since at={r.at} /></span>
                </div>
                {r.comment && <p>{r.comment}</p>}
                <div className="mk-review-tags">
                  {r.tags.map((tag) => (
                    <span key={tag} className="mk-tag">{t(`mk.revtag.${tag}`)}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {reviews.length === 0 && <p className="mk-muted">{t('mk.noreviews')}</p>}
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
