// Dashboard "Interesses" tab: who's interested in my items (as seller) and the
// items I showed interest in (as buyer).
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { type InterestEntry, fetchInterestsReceived, fetchMyInterests } from '../../lib/market/whatsapp';
import { useAuth } from './store';
import { Avatar, Since } from './parts';

function Row({ e, onOpen, onSeller, t }: { e: InterestEntry; onOpen: (id: string) => void; onSeller: (id: string) => void; t: (k: string) => string }) {
  return (
    <div className="mk-interest-row">
      <span className="mk-icon sm" style={{ ['--rar' as string]: 'var(--gold)' }}>{e.listingImage ? <img src={e.listingImage} alt="" className="mk-icon-img" /> : '📦'}</span>
      <div className="mk-interest-body">
        <button className="mk-interest-item" onClick={() => onOpen(e.listingId)}>{e.listingName}</button>
        <div className="mk-interest-meta">
          <button className="mk-interest-who" onClick={() => onSeller(e.otherId)}><Avatar value={e.otherAvatar} /> {e.otherNick}</button>
          <span className={`mk-interest-reason r-${e.reason}`}>{t(`mk.wa.reason.${e.reason}`)}</span>
          <span className="mk-muted">· <Since at={e.createdAt} /></span>
        </div>
        {e.message && <p className="mk-interest-msg">“{e.message}”</p>}
      </div>
    </div>
  );
}

export function InterestsPanel({ onOpen, onSeller }: { onOpen: (id: string) => void; onSeller: (id: string) => void }) {
  const { t } = useI18n();
  const { userId } = useAuth();
  const [received, setReceived] = useState<InterestEntry[]>([]);
  const [sent, setSent] = useState<InterestEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchInterestsReceived(userId), fetchMyInterests(userId)])
      .then(([rec, mine]) => { if (!cancelled) { setReceived(rec); setSent(mine); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="mk-interests">
      {loading && <p className="mk-muted">⏳ {t('mk.loading')}</p>}
      <section className="mk-interests-sec">
        <h3 className="mk-h3">📥 {t('mk.interests.received')} <span className="mk-count">{received.length}</span></h3>
        {received.map((e) => <Row key={e.id} e={e} onOpen={onOpen} onSeller={onSeller} t={t} />)}
        {!loading && received.length === 0 && <p className="mk-muted">{t('mk.interests.noreceived')}</p>}
      </section>
      <section className="mk-interests-sec">
        <h3 className="mk-h3">📤 {t('mk.interests.sent')} <span className="mk-count">{sent.length}</span></h3>
        {sent.map((e) => <Row key={e.id} e={e} onOpen={onOpen} onSeller={onSeller} t={t} />)}
        {!loading && sent.length === 0 && <p className="mk-muted">{t('mk.interests.nosent')}</p>}
      </section>
    </div>
  );
}
