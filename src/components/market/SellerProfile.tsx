import { useState } from 'react';
import { CLASSES, MEDALS } from '../../lib/market/data';
import { fmtPrice } from '../../lib/market/helpers';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { authErrMsg, updateProfileFields } from '../../lib/market/auth';
import { useI18n } from '../../lib/i18n';
import { getSeller, useAuth, useFavSellers } from './store';
import { refreshProfile } from './session';
import { useSellerListings, useSellerReputation } from './useMarketData';
import { AvatarEditor } from './AvatarEditor';
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

  // Edição de classe/clã do PRÓPRIO perfil (aparece só quando `own`).
  const [editing, setEditing] = useState(false);
  const [cls, setCls] = useState('');
  const [clanTxt, setClanTxt] = useState('');
  const [busyEdit, setBusyEdit] = useState(false);
  const [editNote, setEditNote] = useState('');
  // Override local pra UI refletir a mudança NA HORA (o cache demora a renovar).
  const [over, setOver] = useState<{ className?: string; clan?: string }>({});

  if (!seller) {
    return (
      <div className="mk-detail">
        <button className="mk-back" onClick={onBack}>← {t('mk.back')}</button>
        <p className="mk-empty">{loading ? `⏳ ${t('mk.loading')}` : t('mk.notfound')}</p>
      </div>
    );
  }

  // Loja PÚBLICA: só anúncios ativos. Os vendidos ficam exclusivamente na área
  // privada do dono (aba "Vendidos" do Painel), nunca aqui.
  const active = items.filter((i) => i.status === 'available');
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
        {own ? <AvatarEditor userId={userId!} avatar={seller.avatar} size="xxl" /> : <Avatar value={seller.avatar} size="xxl" />}
        <div className="mk-profile-id">
          <h1 className="mk-profile-nick">
            {seller.nick}
            {seller.verified && <span className="mk-verified" title={t('mk.verified')}>✔</span>}
            <RepBadge seller={seller} />
            <ContribSeal sellerId={seller.id} />
          </h1>
          <div className="mk-profile-sub">
            {over.className ?? seller.className} · {t('mk.lvl')} {seller.level} · 🛡 {over.clan ?? seller.clan}
            {own && !editing && (
              <button
                className="mk-linkbtn mk-profile-editbtn"
                onClick={() => { setCls(over.className ?? seller.className); setClanTxt((over.clan ?? seller.clan) === '—' ? '' : (over.clan ?? seller.clan)); setEditNote(''); setEditing(true); }}
              >
                {t('mk.profile.edit')}
              </button>
            )}
          </div>
          {own && editing && (
            <div className="mk-profile-editform">
              <select value={cls} onChange={(e) => setCls(e.target.value)}>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={clanTxt} onChange={(e) => setClanTxt(e.target.value)} placeholder={t('mk.auth.clan')} maxLength={16} />
              <button
                className="mk-btn sm primary"
                disabled={busyEdit}
                onClick={async () => {
                  setBusyEdit(true); setEditNote('');
                  try {
                    const clan = clanTxt.trim() || '—';
                    await updateProfileFields(userId!, { char_class: cls, clan });
                    setOver({ className: cls, clan }); // reflete na hora
                    refreshProfile(); // renova o perfil da sessão (menu, chips…)
                    setEditing(false);
                    setEditNote(t('mk.profile.saved'));
                  } catch (e) {
                    setEditNote(authErrMsg(e));
                  } finally {
                    setBusyEdit(false);
                  }
                }}
              >
                {busyEdit ? '…' : `✓ ${t('mk.profile.save')}`}
              </button>
              <button className="mk-btn sm" onClick={() => setEditing(false)}>{t('mk.cancel')}</button>
            </div>
          )}
          {editNote && <div className="mk-note">{editNote}</div>}
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
